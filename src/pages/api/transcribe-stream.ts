import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { GoogleGenAI, createPartFromUri } from '@google/genai';
import { buildGeminiModelCandidates, readGeminiSettings } from '../../lib/gemini-settings';

const TOOLS_ROOT = path.join(process.cwd(), 'tools');
const PROMPT_PATH = path.join(process.cwd(), 'Transcript.md');
const GEMINI_UPLOAD_MIME = 'audio/ogg';
const GEMINI_TRANSCRIBE_MESSAGE = 'Транскрибируй этот аудиофайл строго по системной инструкции. Верни только итоговую стенограмму.';

type SsePayload = Record<string, unknown>;
type UploadedGeminiFile = {
    name?: string | null;
    uri?: string | null;
    mimeType?: string | null;
};

function toSseEvent(event: string, payload: SsePayload) {
    return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function parseClockToSeconds(value: string) {
    const [h, m, s] = value.split(':');
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

async function findBinary(searchRoot: string, fileName: string): Promise<string | null> {
    const stack: string[] = [searchRoot];

    while (stack.length > 0) {
        const current = stack.pop() as string;
        let entries: import('node:fs').Dirent[] = [];

        try {
            entries = await fs.readdir(current, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
                return fullPath;
            }
            if (entry.isDirectory()) {
                stack.push(fullPath);
            }
        }
    }

    return null;
}

async function startGeminiStream(ai: GoogleGenAI, prompt: string, uploadedFile: UploadedGeminiFile, modelCandidates: string[]) {
    if (!uploadedFile.uri) {
        throw new Error('Gemini upload did not return a file URI.');
    }

    const contents = [
        {
            role: 'user',
            parts: [
                createPartFromUri(uploadedFile.uri, uploadedFile.mimeType ?? GEMINI_UPLOAD_MIME),
                { text: GEMINI_TRANSCRIBE_MESSAGE }
            ]
        }
    ];

    const errors: string[] = [];

    for (const model of modelCandidates) {
        try {
            const response = await ai.models.generateContentStream({
                model,
                config: {
                    systemInstruction: prompt
                },
                contents
            });

            return { model, response };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(`${model}: ${message}`);
        }
    }

    throw new Error(`Gemini did not accept the configured models. ${errors.join(' | ')}`);
}

export const POST: APIRoute = async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    const folderPath = typeof body.folderPath === 'string' ? body.folderPath.trim() : '';
    const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : '';
    const geminiSettings = await readGeminiSettings();
    const geminiApiKey = geminiSettings.apiKey;
    const geminiModelCandidates = buildGeminiModelCandidates(geminiSettings.model);

    if (!folderPath && !filePath) {
        return new Response(JSON.stringify({ error: 'folderPath or filePath is required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!geminiApiKey) {
        return new Response(JSON.stringify({ error: 'Gemini API Key not found in server settings.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    let activeChild: ChildProcessWithoutNullStreams | null = null;
    let closed = false;
    let aborted = false;
    let lastProgress = -1;
    let abortHandler: (() => void) | null = null;

    const stopActiveChild = () => {
        if (activeChild && !activeChild.killed) {
            activeChild.kill();
        }
        activeChild = null;
    };

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const encoder = new TextEncoder();

            const send = (event: string, payload: SsePayload) => {
                if (closed) return;
                try {
                    controller.enqueue(encoder.encode(toSseEvent(event, payload)));
                } catch {
                    closed = true;
                    aborted = true;
                    stopActiveChild();
                }
            };

            const close = () => {
                if (closed) return;
                closed = true;
                stopActiveChild();
                if (abortHandler) {
                    request.signal.removeEventListener('abort', abortHandler);
                    abortHandler = null;
                }
                try {
                    controller.close();
                } catch {
                    // stream may already be closed by the client
                }
            };

            const sendProgress = (percent: number, stage: string) => {
                const normalized = Math.max(0, Math.min(100, Math.round(percent)));
                const monotonic = Math.max(lastProgress, normalized);
                if (monotonic === lastProgress) return;
                lastProgress = monotonic;
                send('progress', { percent: monotonic, stage });
            };

            const run = async () => {
                let convertedAudioPath = '';
                let uploadedFile: UploadedGeminiFile | null = null;

                try {
                    sendProgress(2, 'Проверяю путь...');
                    let resolvedFolderPath = folderPath;
                    let inputFilePath = filePath;

                    if (inputFilePath) {
                        const fileStat = await fs.stat(inputFilePath);
                        if (!fileStat.isFile()) {
                            throw new Error('Selected file is not valid.');
                        }
                        if (!inputFilePath.toLowerCase().endsWith('.m4a')) {
                            throw new Error('Selected file must be .m4a.');
                        }
                        resolvedFolderPath = path.dirname(inputFilePath);
                    } else {
                        const folderStat = await fs.stat(resolvedFolderPath);
                        if (!folderStat.isDirectory()) {
                            throw new Error('Selected path is not a folder.');
                        }
                    }

                    const ffmpegExe = await findBinary(path.join(TOOLS_ROOT, 'ffmpeg'), 'ffmpeg.exe');
                    if (!ffmpegExe) {
                        throw new Error('ffmpeg.exe not found in tools/ffmpeg.');
                    }

                    const prompt = (await fs.readFile(PROMPT_PATH, 'utf8')).trim();
                    if (!prompt) {
                        throw new Error('Transcript.md is empty.');
                    }

                    if (!inputFilePath) {
                        const entries = await fs.readdir(resolvedFolderPath, { withFileTypes: true });
                        const m4aFiles = entries
                            .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.m4a'))
                            .map((entry) => entry.name)
                            .sort((a, b) => a.localeCompare(b, 'ru'));

                        if (m4aFiles.length === 0) {
                            throw new Error('No .m4a files in selected folder.');
                        }

                        inputFilePath = path.join(resolvedFolderPath, m4aFiles[0]);
                    }

                    if (!inputFilePath) {
                        throw new Error('No input file selected.');
                    }

                    const baseName = path.parse(inputFilePath).name;
                    convertedAudioPath = path.join(resolvedFolderPath, `${baseName}.mono16k.ogg`);

                    sendProgress(5, 'Конвертирую в Opus mono...');

                    await new Promise<void>((resolve, reject) => {
                        const ffmpeg = spawn(
                            ffmpegExe,
                            [
                                '-y',
                                '-i',
                                inputFilePath,
                                '-vn',
                                '-ac',
                                '1',
                                '-ar',
                                '16000',
                                '-c:a',
                                'libopus',
                                '-b:a',
                                '24k',
                                '-vbr',
                                'on',
                                '-compression_level',
                                '10',
                                convertedAudioPath
                            ],
                            { windowsHide: true, cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
                        );

                        activeChild = ffmpeg;
                        let stderrBuffer = '';
                        let durationSeconds = 0;

                        ffmpeg.stderr.setEncoding('utf8');
                        ffmpeg.stderr.on('data', (chunk: string) => {
                            stderrBuffer += chunk;

                            if (!durationSeconds) {
                                const durationMatch = stderrBuffer.match(/Duration:\s(\d{2}:\d{2}:\d{2}\.\d+)/);
                                if (durationMatch) {
                                    durationSeconds = parseClockToSeconds(durationMatch[1]);
                                }
                            }

                            const timeMatches = [...chunk.matchAll(/time=(\d{2}:\d{2}:\d{2}\.\d+)/g)];
                            if (durationSeconds > 0 && timeMatches.length > 0) {
                                const currentSeconds = parseClockToSeconds(timeMatches[timeMatches.length - 1][1]);
                                const ratio = Math.max(0, Math.min(1, currentSeconds / durationSeconds));
                                sendProgress(5 + ratio * 35, 'Конвертирую в Opus mono...');
                            }
                        });

                        ffmpeg.on('error', (error) => reject(error));
                        ffmpeg.on('close', (code) => {
                            activeChild = null;
                            if (code === 0) {
                                sendProgress(40, 'Конвертация завершена.');
                                resolve();
                                return;
                            }
                            reject(new Error(stderrBuffer.trim() || `ffmpeg exited with code ${code}`));
                        });
                    });

                    if (aborted) return;

                    sendProgress(50, 'Загружаю аудио в Gemini...');
                    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
                    uploadedFile = await ai.files.upload({
                        file: convertedAudioPath,
                        config: {
                            mimeType: GEMINI_UPLOAD_MIME,
                            displayName: path.basename(convertedAudioPath)
                        }
                    }) as UploadedGeminiFile;

                    if (aborted) return;

                    sendProgress(65, 'Gemini распознаёт...');
                    const { model, response } = await startGeminiStream(ai, prompt, uploadedFile, geminiModelCandidates);
                    let transcript = '';
                    let rollingProgress = 65;

                    for await (const chunk of response) {
                        if (aborted) {
                            break;
                        }

                        const text = typeof chunk.text === 'string' ? chunk.text : '';
                        if (!text) {
                            continue;
                        }

                        transcript += text;
                        rollingProgress = Math.min(98, rollingProgress + Math.max(1, Math.ceil(text.length / 120)));
                        sendProgress(rollingProgress, 'Gemini распознаёт...');
                        send('token', { text, model });
                    }

                    if (aborted) return;

                    if (!transcript.trim()) {
                        throw new Error('Gemini returned an empty transcript.');
                    }

                    sendProgress(100, 'Готово.');
                    send('done', {
                        status: 'ready',
                        sourceFile: inputFilePath,
                        transcript,
                        model
                    });
                    close();
                } catch (error) {
                    if (!aborted) {
                        const message = error instanceof Error ? error.message : 'Transcription failed.';
                        send('error', { message });
                    }
                    close();
                } finally {
                    if (uploadedFile?.name) {
                        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
                        await ai.files.delete({ name: uploadedFile.name }).catch(() => undefined);
                    }
                    if (convertedAudioPath) {
                        await fs.unlink(convertedAudioPath).catch(() => undefined);
                    }
                }
            };

            void run();

            abortHandler = () => {
                aborted = true;
                close();
            };
            request.signal.addEventListener('abort', abortHandler);
        },
        cancel() {
            aborted = true;
            closed = true;
            stopActiveChild();
            if (abortHandler) {
                request.signal.removeEventListener('abort', abortHandler);
                abortHandler = null;
            }
        }
    });

    return new Response(stream, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    });
};


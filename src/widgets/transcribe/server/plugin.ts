import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { GoogleGenAI, createPartFromUri } from '@google/genai';
import { createTranscribeJob, updateTranscribeJobProgress, completeTranscribeJob, failTranscribeJob, listRecentTranscribeJobs } from '../../../core/db/transcribe-repository';
import { secrets } from '../../../core/secrets';
import type { WidgetServerPlugin } from '../../../entities/widget/model/types';
import { jsonResponse, readJsonBody } from '../../../shared/lib/http';

const TOOLS_ROOT = path.join(process.cwd(), 'tools');
const TMP_ROOT = path.join(TOOLS_ROOT, 'tmp');
const PROMPT_PATH = path.join(process.cwd(), 'Transcript.md');
const GEMINI_UPLOAD_MIME = 'audio/ogg';
const GEMINI_TRANSCRIBE_MESSAGE = 'Транскрибируй этот аудиофайл строго по системной инструкции. Верни только итоговую стенограмму.';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const FALLBACK_GEMINI_MODEL = 'gemini-2.0-flash';

type SsePayload = Record<string, unknown>;
type UploadedGeminiFile = {
  name?: string | null;
  uri?: string | null;
  mimeType?: string | null;
};

type ResolvedSelection = {
  filePaths: string[];
  canonicalSourceFile: string;
  resolvedFolderPath: string;
};

type BrowserEntry = {
  name: string;
  path: string;
  type: 'dir' | 'file';
};

function toSseEvent(event: string, payload: SsePayload) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function parseClockToSeconds(value: string) {
  const [hours, minutes, seconds] = value.split(':');
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function escapeConcatPath(filePath: string) {
  return filePath.replace(/'/g, "'\\''");
}

function normalizePath(inputPath: string) {
  const cleaned = inputPath.trim().replace(/\//g, '\\');
  return path.resolve(cleaned);
}

function buildGeminiModelCandidates(primary: string | null) {
  const normalizedPrimary = primary?.trim() || DEFAULT_GEMINI_MODEL;
  const candidates = [normalizedPrimary, DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL];
  return [...new Set(candidates)];
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

async function resolveSelection(folderPath: string, filePath: string, filePaths: string[]): Promise<ResolvedSelection> {
  const normalizedPaths = filePaths
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  const requestedPaths = normalizedPaths.length > 0
    ? normalizedPaths
    : filePath
      ? [filePath]
      : [];

  if (requestedPaths.length === 0) {
    if (!folderPath) {
      throw new Error('folderPath or filePaths is required.');
    }

    const folderStat = await fs.stat(folderPath);
    if (!folderStat.isDirectory()) {
      throw new Error('Selected path is not a folder.');
    }

    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const firstM4a = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.m4a'))
      .map((entry) => path.join(folderPath, entry.name))
      .sort((a, b) => a.localeCompare(b, 'ru'))[0];

    if (!firstM4a) {
      throw new Error('No .m4a files in selected folder.');
    }

    return {
      filePaths: [firstM4a],
      canonicalSourceFile: firstM4a,
      resolvedFolderPath: folderPath
    };
  }

  const validatedPaths: string[] = [];
  let resolvedFolderPath = '';

  for (const currentPathRaw of requestedPaths) {
    const currentPath = normalizePath(currentPathRaw);
    const stat = await fs.stat(currentPath);
    if (!stat.isFile()) {
      throw new Error(`Selected file is not valid: ${currentPath}`);
    }
    if (!currentPath.toLowerCase().endsWith('.m4a')) {
      throw new Error(`Selected file must be .m4a: ${currentPath}`);
    }

    const currentFolder = path.dirname(currentPath);
    if (!resolvedFolderPath) {
      resolvedFolderPath = currentFolder;
    } else if (currentFolder.toLowerCase() !== resolvedFolderPath.toLowerCase()) {
      throw new Error('All selected files must be in the same folder.');
    }

    if (!validatedPaths.some((value) => value.toLowerCase() === currentPath.toLowerCase())) {
      validatedPaths.push(currentPath);
    }
  }

  if (validatedPaths.length === 0) {
    throw new Error('No input file selected.');
  }

  return {
    filePaths: validatedPaths,
    canonicalSourceFile: validatedPaths[0],
    resolvedFolderPath
  };
}

async function listPathEntries(rawPath: string) {
  const requestedPath = typeof rawPath === 'string' ? rawPath : '';
  const targetPath = requestedPath
    ? normalizePath(requestedPath)
    : path.join(process.env.USERPROFILE ?? process.env.HOME ?? process.cwd(), 'OneDrive');

  const stat = await fs.stat(targetPath);
  if (!stat.isDirectory()) {
    throw new Error('Path is not a directory.');
  }

  const dirEntries = await fs.readdir(targetPath, { withFileTypes: true });
  const entries = dirEntries
    .map((entry) => ({
      name: entry.name,
      path: path.join(targetPath, entry.name),
      type: entry.isDirectory() ? 'dir' : 'file'
    } as BrowserEntry))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, 'ru');
    });

  return {
    path: targetPath,
    parentPath: path.dirname(targetPath),
    entries
  };
}

const plugin: WidgetServerPlugin = {
  manifest: {
    widgetId: 'com.yulia.transcribe',
    name: 'Transcribe',
    version: '1.0.0',
    description: 'Gemini-based m4a transcription widget with SSE and outbox.',
    ready: true,
    defaultSize: 'large',
    supportedSizes: ['medium', 'large'],
    capabilities: ['sse', 'transcribe', 'filesystem', 'outbox'],
    channels: ['bus', 'webhook', 'ws']
  },
  handlers: {
    'POST fs-list': async ({ request }) => {
      try {
        const body = await readJsonBody<{ path?: string }>(request);
        const payload = await listPathEntries(body.path ?? '');
        return jsonResponse(payload);
      } catch (error) {
        return jsonResponse({
          error: error instanceof Error ? error.message : 'Failed to list path.'
        }, 500);
      }
    },
    'POST transcript-read': async ({ request }) => {
      const body = await readJsonBody<{ sourceFile?: string; txtPath?: string }>(request);
      const sourceFile = typeof body.sourceFile === 'string' ? body.sourceFile.trim() : '';
      const txtPathFromBody = typeof body.txtPath === 'string' ? body.txtPath.trim() : '';

      if (!sourceFile && !txtPathFromBody) {
        return jsonResponse({ error: 'sourceFile or txtPath is required.' }, 400);
      }

      if (sourceFile && !sourceFile.toLowerCase().endsWith('.m4a')) {
        return jsonResponse({ error: 'sourceFile must point to a .m4a file.' }, 400);
      }

      if (txtPathFromBody && !txtPathFromBody.toLowerCase().endsWith('.txt')) {
        return jsonResponse({ error: 'txtPath must point to a .txt file.' }, 400);
      }

      const txtPath = txtPathFromBody || sourceFile.replace(/\.m4a$/i, '.txt');

      try {
        const stat = await fs.stat(txtPath);
        if (!stat.isFile()) {
          throw new Error('Transcript txt path is not a file.');
        }

        const transcript = await fs.readFile(txtPath, 'utf8');
        return jsonResponse({
          sourceFile: sourceFile || null,
          txtPath,
          transcript
        });
      } catch {
        return jsonResponse({
          error: `Не найден файл стенограммы: ${path.basename(txtPath)}`
        }, 404);
      }
    },
    'GET jobs': async () => {
      return jsonResponse({ jobs: listRecentTranscribeJobs(30) });
    },
    'POST transcribe-stream': async ({ request }) => {
      const body = await readJsonBody<{
        folderPath?: string;
        filePath?: string;
        filePaths?: string[];
      }>(request);

      const folderPath = typeof body.folderPath === 'string' ? body.folderPath.trim() : '';
      const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : '';
      const filePaths = Array.isArray(body.filePaths) ? body.filePaths : [];

      if (!folderPath && !filePath && filePaths.length === 0) {
        return jsonResponse({ error: 'folderPath or filePaths is required.' }, 400);
      }

      const geminiApiKey = secrets.getSecret('GEMINI_API_KEY');
      const geminiModel = secrets.getSecret('GEMINI_MODEL');
      const geminiModelCandidates = buildGeminiModelCandidates(geminiModel);

      if (!geminiApiKey) {
        return jsonResponse({ error: 'GEMINI_API_KEY is missing in environment.' }, 400);
      }

      let activeChild: ChildProcessWithoutNullStreams | null = null;
      let closed = false;
      let aborted = false;
      let lastProgress = -1;
      let abortHandler: (() => void) | null = null;
      let jobId = '';

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
              // ignored
            }
          };

          const sendProgress = (percent: number, stage: string) => {
            const normalized = Math.max(0, Math.min(100, Math.round(percent)));
            const monotonic = Math.max(lastProgress, normalized);
            if (monotonic === lastProgress) return;
            lastProgress = monotonic;
            if (jobId) {
              updateTranscribeJobProgress(jobId, monotonic);
            }
            send('progress', { percent: monotonic, stage });
          };

          const run = async () => {
            let mergedAudioPath = '';
            let concatListPath = '';
            let convertedAudioPath = '';
            let uploadedFile: UploadedGeminiFile | null = null;

            try {
              sendProgress(2, 'Проверяю путь...');
              const selection = await resolveSelection(folderPath, filePath, filePaths);
              const { filePaths: selectedFiles, canonicalSourceFile, resolvedFolderPath } = selection;
              const primaryBaseName = path.parse(canonicalSourceFile).name;
              let inputFilePath = canonicalSourceFile;

              jobId = createTranscribeJob({
                folderPath: resolvedFolderPath,
                filePaths: selectedFiles
              });
              send('progress', { percent: 2, stage: 'Job created', jobId });

              const ffmpegExe = await findBinary(path.join(TOOLS_ROOT, 'ffmpeg'), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
              if (!ffmpegExe) {
                throw new Error('ffmpeg binary not found in tools/ffmpeg.');
              }

              const prompt = (await fs.readFile(PROMPT_PATH, 'utf8')).trim();
              if (!prompt) {
                throw new Error('Transcript.md is empty.');
              }

              await fs.mkdir(TMP_ROOT, { recursive: true });

              if (selectedFiles.length > 1) {
                mergedAudioPath = path.join(TMP_ROOT, `${primaryBaseName}_merged.m4a`);
                concatListPath = path.join(TMP_ROOT, `${primaryBaseName}_merged.concat.txt`);
                await fs.writeFile(
                  concatListPath,
                  selectedFiles.map((value) => `file '${escapeConcatPath(value)}'`).join('\n'),
                  'utf8'
                );

                sendProgress(6, 'Склеиваю записи...');
                await new Promise<void>((resolve, reject) => {
                  const ffmpeg = spawn(
                    ffmpegExe,
                    [
                      '-y',
                      '-f',
                      'concat',
                      '-safe',
                      '0',
                      '-i',
                      concatListPath,
                      '-vn',
                      '-c:a',
                      'aac',
                      '-b:a',
                      '96k',
                      mergedAudioPath
                    ],
                    { windowsHide: true, cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
                  );

                  activeChild = ffmpeg;
                  let stderrBuffer = '';
                  ffmpeg.stderr.setEncoding('utf8');
                  ffmpeg.stderr.on('data', (chunk: string) => {
                    stderrBuffer += chunk;
                  });
                  ffmpeg.on('error', (error) => reject(error));
                  ffmpeg.on('close', (code) => {
                    activeChild = null;
                    if (code === 0) {
                      sendProgress(18, 'Склейка завершена.');
                      resolve();
                      return;
                    }
                    reject(new Error(stderrBuffer.trim() || `ffmpeg exited with code ${code}`));
                  });
                });

                inputFilePath = mergedAudioPath;
              }

              if (aborted) return;

              const convertBaseName = selectedFiles.length > 1 ? `${primaryBaseName}_merged` : primaryBaseName;
              convertedAudioPath = path.join(TMP_ROOT, `${convertBaseName}.mono16k.ogg`);
              const conversionStart = selectedFiles.length > 1 ? 20 : 5;
              const conversionEnd = selectedFiles.length > 1 ? 52 : 40;

              sendProgress(conversionStart, 'Конвертирую в Opus mono...');
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
                    sendProgress(conversionStart + ratio * (conversionEnd - conversionStart), 'Конвертирую в Opus mono...');
                  }
                });

                ffmpeg.on('error', (error) => reject(error));
                ffmpeg.on('close', (code) => {
                  activeChild = null;
                  if (code === 0) {
                    sendProgress(conversionEnd, 'Конвертация завершена.');
                    resolve();
                    return;
                  }
                  reject(new Error(stderrBuffer.trim() || `ffmpeg exited with code ${code}`));
                });
              });

              if (aborted) return;

              sendProgress(60, 'Загружаю аудио в Gemini...');
              const ai = new GoogleGenAI({ apiKey: geminiApiKey });
              uploadedFile = await ai.files.upload({
                file: convertedAudioPath,
                config: {
                  mimeType: GEMINI_UPLOAD_MIME,
                  displayName: path.basename(convertedAudioPath)
                }
              }) as UploadedGeminiFile;

              if (aborted) return;

              sendProgress(72, 'Gemini распознаёт...');
              const { model, response } = await startGeminiStream(ai, prompt, uploadedFile, geminiModelCandidates);
              let transcript = '';
              let rollingProgress = 72;

              for await (const chunk of response) {
                if (aborted) break;

                const text = typeof chunk.text === 'string' ? chunk.text : '';
                if (!text) {
                  continue;
                }

                transcript += text;
                rollingProgress = Math.min(98, rollingProgress + Math.max(1, Math.ceil(text.length / 120)));
                sendProgress(rollingProgress, 'Gemini распознаёт...');
                send('token', { text, model, jobId });
              }

              if (aborted) return;
              if (!transcript.trim()) {
                throw new Error('Gemini returned an empty transcript.');
              }

              const savePath = path.join(resolvedFolderPath, `${primaryBaseName}.txt`);
              await fs.writeFile(savePath, transcript, 'utf8');

              sendProgress(100, 'Готово.');
              if (jobId) {
                completeTranscribeJob(jobId, canonicalSourceFile, savePath);
              }
              send('done', {
                status: 'ready',
                sourceFile: canonicalSourceFile,
                savePath,
                transcript,
                model,
                jobId
              });
              close();
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Transcription failed.';
              if (jobId) {
                failTranscribeJob(jobId, message);
              }
              if (!aborted) {
                send('error', { message, jobId });
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
              if (mergedAudioPath) {
                await fs.unlink(mergedAudioPath).catch(() => undefined);
              }
              if (concatListPath) {
                await fs.unlink(concatListPath).catch(() => undefined);
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
    }
  }
};

export default plugin;

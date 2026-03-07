import type { APIRoute } from 'astro';
import { spawn } from 'node:child_process';

const GEMINI_ENTRY = 'C:\\Users\\julia\\AppData\\Roaming\\npm\\node_modules\\@google\\gemini-cli\\dist\\index.js';
const GEMINI_HOME = 'C:\\Users\\julia';
const REQUEST_TIMEOUT_MS = 120_000;

function createSseEvent(event: string, payload: unknown) {
    return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export const POST: APIRoute = async ({ request }) => {
    const body = await request.json().catch(() => null);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!message) {
        return new Response(JSON.stringify({ error: 'Message is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const encoder = new TextEncoder();
            let stdoutBuffer = '';
            let stderrBuffer = '';
            let isClosed = false;
            let doneSent = false;

            const send = (event: string, payload: unknown) => {
                if (isClosed) return;
                controller.enqueue(encoder.encode(createSseEvent(event, payload)));
            };

            const close = () => {
                if (isClosed) return;
                isClosed = true;
                controller.close();
            };

            const parseStdoutLine = (lineRaw: string) => {
                const line = lineRaw.trim();
                if (!line || !line.startsWith('{')) return;

                try {
                    const msg = JSON.parse(line) as {
                        type?: string;
                        role?: string;
                        content?: string;
                        status?: string;
                        stats?: unknown;
                    };

                    if (msg.type === 'message' && msg.role === 'assistant' && typeof msg.content === 'string') {
                        send('token', { text: msg.content });
                        return;
                    }

                    if (msg.type === 'result') {
                        doneSent = true;
                        send('done', { status: msg.status ?? 'success', stats: msg.stats ?? null });
                    }
                } catch {
                    // Ignore non-JSON lines from CLI bootstrap/logging.
                }
            };

            const flushStdout = (isFinal = false) => {
                while (true) {
                    const newLineIndex = stdoutBuffer.indexOf('\n');
                    if (newLineIndex === -1) break;

                    const line = stdoutBuffer.slice(0, newLineIndex);
                    stdoutBuffer = stdoutBuffer.slice(newLineIndex + 1);
                    parseStdoutLine(line);
                }

                if (isFinal && stdoutBuffer.trim()) {
                    parseStdoutLine(stdoutBuffer);
                    stdoutBuffer = '';
                }
            };

            const child = spawn(
                process.execPath,
                [
                    GEMINI_ENTRY,
                    '--prompt',
                    message,
                    '--output-format',
                    'stream-json'
                ],
                {
                    cwd: process.cwd(),
                    windowsHide: true,
                    env: {
                        ...process.env,
                        HOME: GEMINI_HOME,
                        USERPROFILE: GEMINI_HOME
                    },
                    stdio: ['ignore', 'pipe', 'pipe']
                }
            );

            const timeout = setTimeout(() => {
                child.kill();
                send('error', { message: 'Gemini timeout exceeded (120s).' });
                close();
            }, REQUEST_TIMEOUT_MS);

            child.stdout.setEncoding('utf8');
            child.stderr.setEncoding('utf8');

            child.stdout.on('data', (chunk: string) => {
                stdoutBuffer += chunk;
                flushStdout();
            });

            child.stderr.on('data', (chunk: string) => {
                stderrBuffer += chunk;
            });

            child.on('error', (error) => {
                clearTimeout(timeout);
                send('error', { message: `Failed to start Gemini process: ${error.message}` });
                close();
            });

            child.on('close', (code) => {
                clearTimeout(timeout);
                flushStdout(true);

                if (code !== 0) {
                    const errorText = stderrBuffer.trim() || `Gemini exited with code ${code}`;
                    send('error', { message: errorText });
                    close();
                    return;
                }

                if (!doneSent) {
                    send('done', { status: 'success', stats: null });
                }

                close();
            });

            request.signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                child.kill();
                close();
            });
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

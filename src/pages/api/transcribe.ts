import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const TOOLS_ROOT = path.join(process.cwd(), 'tools');
const WHISPER_EXE = path.join(TOOLS_ROOT, 'whisper', 'Release', 'whisper-cli.exe');
const WHISPER_MODEL = path.join(TOOLS_ROOT, 'whisper', 'ggml-base.bin');

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

function runProcess(command: string, args: string[]) {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(command, args, {
            windowsHide: true,
            cwd: process.cwd()
        });

        let stdout = '';
        let stderr = '';

        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');

        child.stdout.on('data', (chunk) => {
            stdout += chunk;
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk;
        });

        child.on('error', (error) => {
            reject(error);
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
                return;
            }

            reject(new Error(stderr.trim() || `Process failed with code ${code}`));
        });
    });
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json().catch(() => ({}));
        const folderPath = typeof body.folderPath === 'string' ? body.folderPath.trim() : '';

        if (!folderPath) {
            return new Response(JSON.stringify({ error: 'folderPath is required.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const folderStat = await fs.stat(folderPath);
        if (!folderStat.isDirectory()) {
            return new Response(JSON.stringify({ error: 'Selected path is not a folder.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const ffmpegExe = await findBinary(path.join(TOOLS_ROOT, 'ffmpeg'), 'ffmpeg.exe');
        if (!ffmpegExe) {
            return new Response(JSON.stringify({ error: 'ffmpeg.exe not found in tools/ffmpeg.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        await fs.access(WHISPER_EXE);
        await fs.access(WHISPER_MODEL);

        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        const m4aFiles = entries
            .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.m4a'))
            .map((entry) => entry.name)
            .sort((a, b) => a.localeCompare(b, 'ru'));

        if (m4aFiles.length === 0) {
            return new Response(JSON.stringify({ error: 'No .m4a files in selected folder.' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const inputFileName = m4aFiles[0];
        const inputFilePath = path.join(folderPath, inputFileName);
        const baseName = path.parse(inputFileName).name;
        const wavPath = path.join(folderPath, `${baseName}.mono16k.wav`);
        const outputBase = path.join(folderPath, `${baseName}.transcript`);
        const outputTxtPath = `${outputBase}.txt`;

        await runProcess(ffmpegExe, [
            '-y',
            '-i',
            inputFilePath,
            '-ac',
            '1',
            '-ar',
            '16000',
            '-acodec',
            'pcm_s16le',
            wavPath
        ]);

        await runProcess(WHISPER_EXE, [
            '-m',
            WHISPER_MODEL,
            '-f',
            wavPath,
            '-l',
            'ru',
            '-otxt',
            '-of',
            outputBase,
            '-np',
            '-nt'
        ]);

        const transcript = await fs.readFile(outputTxtPath, 'utf8');

        return new Response(JSON.stringify({
            status: 'ready',
            sourceFile: inputFilePath,
            transcriptFile: outputTxtPath,
            transcript
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Transcription failed:', error);
        const message = error instanceof Error ? error.message : 'Transcription failed.';
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json().catch(() => ({}));
        const sourceFile = typeof body.sourceFile === 'string' ? body.sourceFile.trim() : '';
        const transcript = typeof body.transcript === 'string' ? body.transcript : '';

        if (!sourceFile) {
            return new Response(JSON.stringify({ error: 'sourceFile is required.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!transcript.trim()) {
            return new Response(JSON.stringify({ error: 'Transcript is empty.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const parsed = path.parse(sourceFile);
        const savePath = path.join(parsed.dir, `${parsed.name}.txt`);
        await fs.writeFile(savePath, transcript, 'utf8');

        return new Response(JSON.stringify({ status: 'saved', savePath }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save transcript.';
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};


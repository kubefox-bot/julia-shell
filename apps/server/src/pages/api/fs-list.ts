import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

function normalizePath(inputPath: string) {
    const cleaned = inputPath.trim().replace(/\//g, '\\');
    return path.resolve(cleaned);
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json().catch(() => ({}));
        const requestedPath = typeof body.path === 'string' ? body.path : '';
        const targetPath = requestedPath ? normalizePath(requestedPath) : path.join(process.env.USERPROFILE ?? 'C:\\Users\\julia', 'OneDrive');

        const stat = await fs.stat(targetPath);
        if (!stat.isDirectory()) {
            return new Response(JSON.stringify({ error: 'Path is not a directory.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const dirEntries = await fs.readdir(targetPath, { withFileTypes: true });
        const entries = dirEntries
            .map((entry) => ({
                name: entry.name,
                path: path.join(targetPath, entry.name),
                type: entry.isDirectory() ? 'dir' : 'file'
            }))
            .sort((a, b) => {
                if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
                return a.name.localeCompare(b.name, 'ru');
            });

        return new Response(JSON.stringify({
            path: targetPath,
            parentPath: path.dirname(targetPath),
            entries
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list path.';
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

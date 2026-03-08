import type { APIRoute } from 'astro';
import { exec } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

export const POST: APIRoute = async () => {
    const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');
    
    return new Promise((resolve) => {
        exec(`start "" "${DOWNLOADS_DIR}"`, (err) => {
            if (err) {
                resolve(new Response(JSON.stringify({ error: 'Failed to open folder' }), { status: 500 }));
            } else {
                resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
            }
        });
    });
};

import type { APIRoute } from 'astro';
import { getServerStatus } from '../../lib/server-control';

export const GET: APIRoute = async () => {
    const status = await getServerStatus();

    return new Response(JSON.stringify(status), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};

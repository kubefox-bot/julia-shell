import type { APIRoute } from 'astro';
import { controlServer, type ServerAction } from '../../lib/server-control';

const VALID_ACTIONS = new Set<ServerAction>(['start', 'restart', 'stop']);

export const POST: APIRoute = async ({ request }) => {
    const body = await request.json().catch(() => null);
    const action = typeof body?.action === 'string' ? body.action.trim().toLowerCase() : '';

    if (!VALID_ACTIONS.has(action as ServerAction)) {
        return new Response(JSON.stringify({ error: 'Invalid action.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const result = await controlServer(action as ServerAction);
        return new Response(JSON.stringify(result), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server control failed.';
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

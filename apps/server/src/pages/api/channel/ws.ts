import type { APIRoute } from 'astro';
import { withSetCookie } from '@passport/server/cookie';
import { resolvePassportRequestContext } from '@passport/server/context';
import {
  HTTP_STATUS_ACCEPTED,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_OK,
  HTTP_STATUS_UNAUTHORIZED
} from '@shared/lib/http-status';
import { moduleBus, type EventPayload } from '@shared/lib/module-bus';
import { jsonResponse, readJsonBody } from '@shared/lib/http';
import { nowIso } from '@shared/lib/time';

const HEARTBEAT_INTERVAL_MS = 15_000;

function formatSseEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export const GET: APIRoute = async ({ request }) => {
  const resolvedAuth = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: false
  });
  if (!resolvedAuth.context) {
    return jsonResponse({ error: 'Unauthorized channel access.' }, HTTP_STATUS_UNAUTHORIZED);
  }

  const url = new URL(request.url);
  const topic = (url.searchParams.get('topic') ?? '*').trim() || '*';

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(formatSseEvent(event, payload)));
      };

      const unsubscribe = moduleBus.subscribe(topic, (eventPayload: EventPayload) => {
        send('message', eventPayload);
      });

      const heartbeat = setInterval(() => {
        send('ping', {
          timestamp: nowIso(),
          topic
        });
      }, HEARTBEAT_INTERVAL_MS);

      send('open', {
        transport: 'sse-fallback',
        requestedTransport: 'ws',
        topic
      });

      request.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // ignored
        }
      });
    }
  });

  const response = new Response(stream, {
    status: HTTP_STATUS_OK,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });

  return withSetCookie(response, resolvedAuth.context.setCookieHeader);
};

export const POST: APIRoute = async ({ request }) => {
  const resolvedAuth = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: false
  });
  if (!resolvedAuth.context) {
    return jsonResponse({ error: 'Unauthorized channel access.' }, HTTP_STATUS_UNAUTHORIZED);
  }

  const body = await readJsonBody<{
    topic?: string;
    source?: string;
    payload?: unknown;
  }>(request);

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'api/channel/ws';

  if (!topic) {
    return jsonResponse({ error: 'topic is required.' }, HTTP_STATUS_BAD_REQUEST);
  }

  moduleBus.publish(topic, source, body.payload ?? null);

  return withSetCookie(jsonResponse({ accepted: true, topic }, HTTP_STATUS_ACCEPTED), resolvedAuth.context.setCookieHeader);
};

import type { APIRoute } from 'astro';
import { moduleBus, type EventPayload } from '../../../shared/lib/module-bus';
import { isChannelAuthorized } from '../../../shared/lib/channel-auth';
import { jsonResponse, readJsonBody } from '../../../shared/lib/http';

function formatSseEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export const GET: APIRoute = async ({ request }) => {
  if (!(await isChannelAuthorized(request))) {
    return jsonResponse({ error: 'Unauthorized channel access.' }, 401);
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
          timestamp: new Date().toISOString(),
          topic
        });
      }, 15_000);

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

export const POST: APIRoute = async ({ request }) => {
  if (!(await isChannelAuthorized(request))) {
    return jsonResponse({ error: 'Unauthorized channel access.' }, 401);
  }

  const body = await readJsonBody<{
    topic?: string;
    source?: string;
    payload?: unknown;
  }>(request);

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'api/channel/ws';

  if (!topic) {
    return jsonResponse({ error: 'topic is required.' }, 400);
  }

  moduleBus.publish(topic, source, body.payload ?? null);

  return jsonResponse({ accepted: true, topic }, 202);
};

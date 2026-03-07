import type { APIRoute } from 'astro';
import { moduleBus } from '../../../../../shared/lib/module-bus';
import { isChannelAuthorized } from '../../../../../shared/lib/channel-auth';
import { jsonResponse, readJsonBody } from '../../../../../shared/lib/http';

export const POST: APIRoute = async ({ request, params }) => {
  if (!isChannelAuthorized(request)) {
    return jsonResponse({ error: 'Unauthorized channel access.' }, 401);
  }

  const widgetId = params.id;
  const eventName = params.event;

  if (!widgetId || !eventName) {
    return jsonResponse({ error: 'Missing webhook path params.' }, 400);
  }

  const payload = await readJsonBody(request);
  const topic = `webhook:${widgetId}:${eventName}`;

  moduleBus.publish(topic, 'webhook', payload);

  return jsonResponse({
    accepted: true,
    topic,
    widgetId,
    event: eventName
  }, 202);
};

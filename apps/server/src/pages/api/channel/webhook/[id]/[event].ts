import type { APIRoute } from 'astro';
import { withSetCookie } from '@passport/server/cookie';
import { resolvePassportRequestContext } from '@passport/server/context';
import { moduleBus } from '@shared/lib/module-bus';
import { jsonResponse, readJsonBody } from '@shared/lib/http';

const STATUS_ACCEPTED = 202;
const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;

export const POST: APIRoute = async ({ request, params }) => {
  const resolvedAuth = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: true
  });
  if (!resolvedAuth.context) {
    return jsonResponse({ error: 'Unauthorized channel access.' }, STATUS_UNAUTHORIZED);
  }

  const widgetId = params.id;
  const eventName = params.event;

  if (!widgetId || !eventName) {
    return jsonResponse({ error: 'Missing webhook path params.' }, STATUS_BAD_REQUEST);
  }

  const payload = await readJsonBody(request);
  const topic = `webhook:${widgetId}:${eventName}`;

  moduleBus.publish(topic, 'webhook', payload);

  return withSetCookie(jsonResponse({
    accepted: true,
    topic,
    widgetId,
    event: eventName
  }, STATUS_ACCEPTED), resolvedAuth.context.setCookieHeader);
};

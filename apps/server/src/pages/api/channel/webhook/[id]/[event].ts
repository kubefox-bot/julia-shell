import type { APIRoute } from 'astro';
import { withSetCookie } from '@passport/server/cookie';
import { resolvePassportRequestContext } from '@passport/server/context';
import { moduleBus } from '@shared/lib/module-bus';
import { jsonResponse, readJsonBody } from '@shared/lib/http';

export const POST: APIRoute = async ({ request, params }) => {
  const resolvedAuth = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: true
  });
  if (!resolvedAuth.context) {
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

  return withSetCookie(jsonResponse({
    accepted: true,
    topic,
    widgetId,
    event: eventName
  }, 202), resolvedAuth.context.setCookieHeader);
};

import type { APIRoute } from 'astro';
import { setShellModuleEnabled } from '@core/services/shell-service';
import { PASSPORT_ANONYMOUS_AGENT_ID } from '@passport/server/config/consts';
import { resolvePassportRequestContext } from '@passport/server/context';
import { withSetCookie } from '@passport/server/cookie';
import { PASSPORT_HTTP_STATUS } from '@passport/server/http';
import { jsonResponse } from '@shared/lib/http';

export const POST: APIRoute = async ({ params, request }) => {
  const resolvedAuth = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: false
  });
  const hasPassportAccess = Boolean(resolvedAuth.context);
  const agentId = resolvedAuth.context?.agentId ?? PASSPORT_ANONYMOUS_AGENT_ID;

  const widgetId = params.id;
  if (!widgetId) {
    return jsonResponse({ error: 'Missing widgetId.' }, PASSPORT_HTTP_STATUS.badRequest);
  }

  const result = await setShellModuleEnabled(agentId, widgetId, false, { hasPassportAccess });

  if (!result.ok) {
    return jsonResponse({ error: result.message }, result.status);
  }

  return withSetCookie(jsonResponse({ module: result.module }), resolvedAuth.context?.setCookieHeader ?? null);
};

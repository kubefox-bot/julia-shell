import type { APIRoute } from 'astro';
import { setShellModuleEnabled } from '../../../../../core/services/shell-service';
import { resolvePassportRequestContext } from '../../../../../domains/passport/server/context';
import { withSetCookie } from '../../../../../domains/passport/server/cookie';
import { jsonResponse } from '../../../../../shared/lib/http';

export const POST: APIRoute = async ({ params, request }) => {
  const resolvedAuth = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: true
  });
  if (!resolvedAuth.context) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const widgetId = params.id;
  if (!widgetId) {
    return jsonResponse({ error: 'Missing widgetId.' }, 400);
  }

  const result = await setShellModuleEnabled(resolvedAuth.context.agentId, widgetId, false);

  if (!result.ok) {
    return jsonResponse({ error: result.message }, result.status);
  }

  return withSetCookie(jsonResponse({ module: result.module }), resolvedAuth.context.setCookieHeader);
};

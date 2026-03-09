import type { APIRoute } from 'astro';
import { getShellSettings } from '../../../core/services/shell-service';
import { resolvePassportRequestContext } from '../../../domains/passport/server/context';
import { withSetCookie } from '../../../domains/passport/server/cookie';
import { jsonResponse } from '../../../shared/lib/http';

export const GET: APIRoute = async ({ request }) => {
  const resolvedAuth = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: true
  });
  if (!resolvedAuth.context) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const settings = await getShellSettings(resolvedAuth.context.agentId);
  return withSetCookie(jsonResponse(settings), resolvedAuth.context.setCookieHeader);
};

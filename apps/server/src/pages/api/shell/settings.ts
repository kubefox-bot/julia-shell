import type { APIRoute } from 'astro';
import { getShellSettings } from '../../../core/services/shell-service';
import { PASSPORT_ANONYMOUS_AGENT_ID } from '@passport/server/config/consts';
import { resolvePassportRequestContext } from '@passport/server/context';
import { withSetCookie } from '@passport/server/cookie';
import { buildLocaleCookieHeader } from '../../../shared/lib/locale-cookie';
import { jsonResponse } from '../../../shared/lib/http';

export const GET: APIRoute = async ({ request }) => {
  const resolvedAuth = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: false
  });
  const hasPassportAccess = Boolean(resolvedAuth.context);
  const agentId = resolvedAuth.context?.agentId ?? PASSPORT_ANONYMOUS_AGENT_ID;

  const settings = await getShellSettings(agentId, { hasPassportAccess });
  const response = withSetCookie(jsonResponse(settings), resolvedAuth.context?.setCookieHeader ?? null);
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', buildLocaleCookieHeader({ locale: settings.layoutSettings.locale, request }));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

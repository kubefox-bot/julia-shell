import type { APIRoute } from 'astro';
import { listShellModules } from '@core/services/shell-service';
import { PASSPORT_ANONYMOUS_AGENT_ID } from '@passport/server/config/consts';
import { resolvePassportRequestContext } from '@passport/server/context';
import { withSetCookie } from '@passport/server/cookie';
import { jsonResponse } from '@shared/lib/http';

export const GET: APIRoute = async ({ request }) => {
  const resolvedAuth = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: false
  });
  const hasPassportAccess = Boolean(resolvedAuth.context);
  const agentId = resolvedAuth.context?.agentId ?? PASSPORT_ANONYMOUS_AGENT_ID;

  const modules = await listShellModules(agentId, { hasPassportAccess });
  return withSetCookie(jsonResponse({ modules }), resolvedAuth.context?.setCookieHeader ?? null);
};

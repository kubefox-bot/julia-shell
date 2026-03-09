import type { APIRoute } from 'astro';
import { withSetCookie } from '../../../../domains/passport/server/cookie';
import { resolvePassportRequestContext } from '../../../../domains/passport/server/context';
import { PASSPORT_HTTP_STATUS } from '../../../../domains/passport/server/http';
import { passportRuntime } from '../../../../domains/passport/server/runtime';
import { jsonResponse } from '../../../../shared/lib/http';

export const GET: APIRoute = async ({ request }) => {
  const runtimeSnapshot = passportRuntime.getAgentStatusSnapshot();
  const resolved = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: false
  });
  const responsePayload = resolved.context
    ? runtimeSnapshot
    : {
        ...runtimeSnapshot,
        status: 'disconnected',
        label: 'Disconnected',
        reason: 'No browser access token.',
        hostname: null,
        agentId: null
      };
  const response = jsonResponse(responsePayload, PASSPORT_HTTP_STATUS.ok);

  return withSetCookie(response, resolved.context?.setCookieHeader ?? null);
};

import type { APIRoute } from 'astro';
import { withSetCookie } from '@passport/server/cookie';
import { resolvePassportRequestContext } from '@passport/server/context';
import { PASSPORT_HTTP_STATUS } from '@passport/server/http';
import { passportRuntime } from '@passport/server/runtime';
import { jsonResponse } from '../../../../../shared/lib/http';

export const POST: APIRoute = async ({ request }) => {
  const runtimeSnapshot = passportRuntime.retryStatusSnapshot();
  const resolved = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: true
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

import type { APIRoute } from 'astro';
import { withSetCookie } from '@passport/server/cookie';
import { resolvePassportRequestContext } from '@passport/server/context';
import { PASSPORT_HTTP_STATUS } from '@passport/server/http';
import { passportRuntime } from '@passport/server/runtime';
import { jsonResponse } from '@shared/lib/http';

export const POST: APIRoute = async ({ request }) => {
  const resolved = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: false
  });

  const responsePayload = resolved.context
    ? passportRuntime.retryStatusSnapshot(resolved.context.agentId)
    : resolved.reason === 'invalid'
      ? {
          status: 'unauthorized',
          label: 'Unauthorized',
          updatedAt: new Date().toISOString(),
          reason: 'Invalid browser access token.',
          hostname: null,
          agentId: null
        }
      : {
        status: 'disconnected',
        label: 'Disconnected',
        updatedAt: new Date().toISOString(),
        reason: 'No browser access token.',
        hostname: null,
        agentId: null
      };
  const response = jsonResponse(responsePayload, PASSPORT_HTTP_STATUS.ok);

  return withSetCookie(response, resolved.context?.setCookieHeader ?? null);
};

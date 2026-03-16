import type { APIRoute } from 'astro';
import { withSetCookie } from '@passport/server/cookie';
import { resolvePassportRequestContext } from '@passport/server/context';
import { PASSPORT_HTTP_STATUS } from '@passport/server/http';
import { passportRuntime } from '@passport/server/runtime';
import { jsonResponse } from '@shared/lib/http';
import { resolveBrowserStatusPayload } from './status/shared';

export const GET: APIRoute = async ({ request }) => {
  const resolved = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: false
  });
  const responsePayload = resolveBrowserStatusPayload(
    resolved,
    passportRuntime.getAgentStatusSnapshot.bind(passportRuntime)
  );
  const response = jsonResponse(responsePayload, PASSPORT_HTTP_STATUS.ok);

  return withSetCookie(response, resolved.context?.setCookieHeader ?? null);
};

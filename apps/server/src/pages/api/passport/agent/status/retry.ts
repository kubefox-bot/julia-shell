import type { APIRoute } from 'astro';
import { withSetCookie } from '../../../../../domains/passport/server/cookie';
import { resolvePassportRequestContext } from '../../../../../domains/passport/server/context';
import { PASSPORT_HTTP_STATUS } from '../../../../../domains/passport/server/http';
import { passportRuntime } from '../../../../../domains/passport/server/runtime';
import { jsonResponse } from '../../../../../shared/lib/http';

export const POST: APIRoute = async ({ request }) => {
  const response = jsonResponse(passportRuntime.retryStatusSnapshot(), PASSPORT_HTTP_STATUS.ok);
  const resolved = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: true
  });

  return withSetCookie(response, resolved.context?.setCookieHeader ?? null);
};

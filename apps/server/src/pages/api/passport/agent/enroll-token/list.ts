import type { APIRoute } from 'astro';
import { isPassportAdminAuthorized } from '../../../../../domains/passport/server/config/admin-auth';
import { passportErrorResponse } from '../../../../../domains/passport/server/http';
import { listEnrollmentTokens } from '../../../../../domains/passport/server/repository';
import { jsonResponse } from '../../../../../shared/lib/http';

export const GET: APIRoute = async ({ request }) => {
  if (!(await isPassportAdminAuthorized(request))) {
    return passportErrorResponse('unauthorized');
  }

  return jsonResponse({ tokens: listEnrollmentTokens() });
};

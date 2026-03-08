import type { APIRoute } from 'astro';
import { isAdminAuthorized } from '../../../../core/agent/admin-auth';
import { listEnrollmentTokens } from '../../../../core/agent/repository';
import { jsonResponse } from '../../../../shared/lib/http';

export const GET: APIRoute = async ({ request }) => {
  if (!(await isAdminAuthorized(request))) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  return jsonResponse({ tokens: listEnrollmentTokens() });
};

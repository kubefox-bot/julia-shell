import type { APIRoute } from 'astro';
import { isAdminAuthorized } from '../../../../core/agent/admin-auth';
import { revokeEnrollmentToken } from '../../../../core/agent/repository';
import { jsonResponse, readJsonBody } from '../../../../shared/lib/http';

export const POST: APIRoute = async ({ request }) => {
  if (!(await isAdminAuthorized(request))) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const body = await readJsonBody<{ token_id?: string }>(request);
  const tokenId = typeof body.token_id === 'string' ? body.token_id.trim() : '';

  if (!tokenId) {
    return jsonResponse({ error: 'token_id is required.' }, 400);
  }

  const revoked = revokeEnrollmentToken(tokenId);
  return jsonResponse({ revoked });
};

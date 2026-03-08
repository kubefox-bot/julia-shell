import type { APIRoute } from 'astro';
import { isAdminAuthorized } from '../../../../core/agent/admin-auth';
import { createEnrollmentToken } from '../../../../core/agent/repository';
import { jsonResponse, readJsonBody } from '../../../../shared/lib/http';

export const POST: APIRoute = async ({ request }) => {
  if (!(await isAdminAuthorized(request))) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const body = await readJsonBody<{
    ttl_minutes?: number;
    uses?: number;
    label?: string;
  }>(request);

  const created = createEnrollmentToken({
    ttlMinutes: body.ttl_minutes,
    uses: body.uses,
    label: body.label
  });

  return jsonResponse({
    token_id: created.tokenId,
    enrollment_token: created.enrollmentToken,
    expires_at: created.expiresAt,
    uses: created.uses
  }, 201);
};

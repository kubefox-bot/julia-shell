import type { APIRoute } from 'astro';
import { enrollAgent } from '../../../core/agent/service';
import { jsonResponse, readJsonBody } from '../../../shared/lib/http';

export const POST: APIRoute = async ({ request }) => {
  const body = await readJsonBody<{
    enrollment_token?: string;
    device_info?: string;
    agent_version?: string;
    capabilities?: unknown;
  }>(request);

  const enrollmentToken = typeof body.enrollment_token === 'string' ? body.enrollment_token.trim() : '';
  if (!enrollmentToken) {
    return jsonResponse({ error: 'enrollment_token is required.' }, 400);
  }

  const enrolled = await enrollAgent({
    enrollmentToken,
    deviceInfo: typeof body.device_info === 'string' ? body.device_info.trim() : 'agent',
    agentVersion: typeof body.agent_version === 'string' ? body.agent_version.trim() : 'unknown',
    capabilities: body.capabilities
  });

  if (!enrolled) {
    return jsonResponse({ error: 'Enrollment token is invalid or expired.' }, 401);
  }

  return jsonResponse({
    agent_id: enrolled.agentId,
    access_jwt: enrolled.accessJwt,
    refresh_token: enrolled.refreshToken,
    expires_in: enrolled.expiresIn
  });
};

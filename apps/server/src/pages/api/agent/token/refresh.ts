import type { APIRoute } from 'astro';
import { refreshAgentSession } from '../../../../core/agent/service';
import { jsonResponse, readJsonBody } from '../../../../shared/lib/http';

export const POST: APIRoute = async ({ request }) => {
  const body = await readJsonBody<{
    agent_id?: string;
    refresh_token?: string;
  }>(request);

  const agentId = typeof body.agent_id === 'string' ? body.agent_id.trim() : '';
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token.trim() : '';

  if (!agentId || !refreshToken) {
    return jsonResponse({ error: 'agent_id and refresh_token are required.' }, 400);
  }

  const refreshed = await refreshAgentSession({ agentId, refreshToken });
  if (!refreshed) {
    return jsonResponse({ error: 'Refresh token is invalid or expired.' }, 401);
  }

  return jsonResponse({
    agent_id: refreshed.agentId,
    access_jwt: refreshed.accessJwt,
    refresh_token: refreshed.refreshToken,
    expires_in: refreshed.expiresIn
  });
};

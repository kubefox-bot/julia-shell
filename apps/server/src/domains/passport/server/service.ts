import { issueAccessJwt } from './jwt';
import { resolvePassportJwtSecret } from './config/jwt-secret';
import {
  normalizeAgentCapabilities,
  resolveAgentDisplayName,
  resolveAgentVersion
} from './models';
import {
  consumeEnrollmentToken,
  issueRefreshToken,
  registerAgent,
  revokeRefreshToken,
  rotateRefreshToken
} from './repository';

/**
 * Performs first-time enroll with strict `(agent_id, enrollment_token)` validation.
 */
export async function enrollPassportAgent(input: {
  agentId: string;
  enrollmentToken: string;
  deviceInfo: string;
  agentVersion: string;
  capabilities: unknown;
}) {
  const consumed = consumeEnrollmentToken(input.enrollmentToken, input.agentId);
  if (!consumed) {
    return null;
  }

  const agentId = registerAgent({
    agentId: input.agentId,
    displayName: resolveAgentDisplayName(input.deviceInfo),
    capabilities: normalizeAgentCapabilities(input.capabilities),
    version: resolveAgentVersion(input.agentVersion)
  });

  const refresh = issueRefreshToken(agentId);
  const secret = await resolvePassportJwtSecret();
  const access = issueAccessJwt(secret, agentId);

  return {
    agentId,
    accessJwt: access.token,
    refreshToken: refresh.refreshToken,
    expiresIn: access.expiresIn
  };
}

export async function refreshPassportSession(input: { agentId: string; refreshToken: string }) {
  const rotated = rotateRefreshToken(input.agentId, input.refreshToken);
  if (!rotated) {
    return null;
  }

  const secret = await resolvePassportJwtSecret();
  const access = issueAccessJwt(secret, input.agentId);

  return {
    agentId: input.agentId,
    accessJwt: access.token,
    refreshToken: rotated.refreshToken,
    expiresIn: access.expiresIn
  };
}

export function revokePassportSession(input: { agentId: string; refreshToken: string }) {
  return revokeRefreshToken(input.agentId, input.refreshToken);
}

export async function issuePassportBrowserAccess(agentId: string) {
  const secret = await resolvePassportJwtSecret();
  const access = issueAccessJwt(secret, agentId);

  return {
    agentId,
    accessJwt: access.token,
    expiresIn: access.expiresIn
  };
}

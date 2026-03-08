import { issueAccessJwt } from './jwt';
import { resolveAgentJwtSecret } from './config';
import {
  consumeEnrollmentToken,
  issueRefreshToken,
  registerAgent,
  revokeRefreshToken,
  rotateRefreshToken,
} from './repository';

function parseCapabilities(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

export async function enrollAgent(input: {
  enrollmentToken: string;
  deviceInfo: string;
  agentVersion: string;
  capabilities: unknown;
}) {
  const consumed = consumeEnrollmentToken(input.enrollmentToken);
  if (!consumed) {
    return null;
  }

  const agentId = registerAgent({
    displayName: input.deviceInfo || 'agent',
    capabilities: parseCapabilities(input.capabilities),
    version: input.agentVersion || 'unknown'
  });

  const refresh = issueRefreshToken(agentId);
  const secret = await resolveAgentJwtSecret();
  const access = issueAccessJwt(secret, agentId);

  return {
    agentId,
    accessJwt: access.token,
    refreshToken: refresh.refreshToken,
    expiresIn: access.expiresIn
  };
}

export async function refreshAgentSession(input: { agentId: string; refreshToken: string }) {
  const rotated = rotateRefreshToken(input.agentId, input.refreshToken);
  if (!rotated) {
    return null;
  }

  const secret = await resolveAgentJwtSecret();
  const access = issueAccessJwt(secret, input.agentId);

  return {
    agentId: input.agentId,
    accessJwt: access.token,
    refreshToken: rotated.refreshToken,
    expiresIn: access.expiresIn
  };
}

export function revokeAgentSession(input: { agentId: string; refreshToken: string }) {
  return revokeRefreshToken(input.agentId, input.refreshToken);
}

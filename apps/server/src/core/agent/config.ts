import { secrets } from '../secrets/secrets';

const LAN_FALLBACK_JWT_SECRET = 'julia-agent-lan-insecure-secret';

export async function resolveAgentJwtSecret() {
  const secret = await secrets.get('AGENT_JWT_SECRET', '/');
  const value = secret?.value?.trim() ?? '';
  if (value) {
    return value;
  }

  return LAN_FALLBACK_JWT_SECRET;
}

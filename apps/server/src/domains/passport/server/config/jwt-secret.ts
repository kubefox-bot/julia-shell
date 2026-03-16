import { secrets } from '@core/secrets/secrets';

/**
 * Resolves the shared JWT signing secret used by both agent and browser flows.
 */
export async function resolvePassportJwtSecret() {
  const secret = await secrets.get('AGENT_JWT_SECRET', '/');
  const value = secret?.value?.trim() ?? '';
  if (value) {
    return value;
  }

  throw new Error('Missing required startup secret: AGENT_JWT_SECRET');
}

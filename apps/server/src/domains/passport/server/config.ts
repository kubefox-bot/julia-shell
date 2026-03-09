import { secrets } from '../../../core/secrets/secrets';
import { PASSPORT_LAN_FALLBACK_JWT_SECRET } from './consts';

/**
 * Resolves the shared JWT signing secret used by both agent and browser flows.
 */
export async function resolvePassportJwtSecret() {
  const secret = await secrets.get('AGENT_JWT_SECRET', '/');
  const value = secret?.value?.trim() ?? '';
  if (value) {
    return value;
  }

  return PASSPORT_LAN_FALLBACK_JWT_SECRET;
}

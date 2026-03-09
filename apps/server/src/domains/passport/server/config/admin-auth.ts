import { secrets } from '@/core/secrets/secrets';
import { safeEqual } from '../crypto';

/**
 * Validates admin token for privileged passport endpoints.
 */
export async function isPassportAdminAuthorized(request: Request) {
  const expected = await secrets.get('ADMIN_TOKEN', '/');
  const provided = request.headers.get('X-Admin-Token')?.trim() ?? '';
  if (!expected?.value || !provided) {
    return false;
  }

  return safeEqual(provided, expected.value);
}

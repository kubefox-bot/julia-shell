import { secrets } from '../secrets/secrets';
import { safeEqual } from './crypto';

export async function isAdminAuthorized(request: Request) {
  const expected = await secrets.get('ADMIN_TOKEN');
  const provided = request.headers.get('X-Admin-Token')?.trim() ?? '';

  if (!expected?.value || !provided) {
    return false;
  }

  return safeEqual(provided, expected.value);
}

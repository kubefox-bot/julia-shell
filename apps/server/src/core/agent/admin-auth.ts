import { secrets } from '../secrets/secrets';
import { safeEqual } from './crypto';

export async function isAdminAuthorized(request: Request) {
  const expected = await secrets.get('ADMIN_TOKEN', '/');
  const provided = request.headers.get('X-Admin-Token')?.trim() ?? '';

  console.log("!!!!!!!!!!!!!!!", expected, provided);
  if (!expected?.value || expected.source !== 'infisical' || !provided) {
    return false;
  }

  return safeEqual(provided, expected.value);
}

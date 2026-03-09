import { jsonResponse } from '@shared/lib/http';
import { PASSPORT_HTTP_ERROR_CATALOG, type PassportHttpErrorKey } from './error-catalog';

/**
 * Builds unified error responses for passport API routes.
 */
export function passportErrorResponse(key: PassportHttpErrorKey) {
  const error = PASSPORT_HTTP_ERROR_CATALOG[key];
  return jsonResponse({ error: error.message }, error.status);
}

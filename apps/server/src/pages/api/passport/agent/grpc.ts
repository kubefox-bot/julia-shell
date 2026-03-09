import type { APIRoute } from 'astro';
import { PASSPORT_HTTP_ERROR_CATALOG } from '@passport/server/http';
import { jsonResponse } from '@shared/lib/http';

export const POST: APIRoute = async () => {
  const descriptor = PASSPORT_HTTP_ERROR_CATALOG.grpcUpgradeRequired;
  return jsonResponse({
    error: descriptor.message,
    hint: descriptor.hint
  }, descriptor.status);
};

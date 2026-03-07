import type { APIRoute } from 'astro';
import { getShellSettings } from '../../../core/services/shell-service';
import { jsonResponse } from '../../../shared/lib/http';

export const GET: APIRoute = async () => {
  const settings = await getShellSettings();
  return jsonResponse(settings);
};

import type { APIRoute } from 'astro';
import { listShellModules } from '../../../core/services/shell-service';
import { jsonResponse } from '../../../shared/lib/http';

export const GET: APIRoute = async () => {
  const modules = await listShellModules();
  return jsonResponse({ modules });
};

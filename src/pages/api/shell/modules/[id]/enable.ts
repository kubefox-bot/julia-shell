import type { APIRoute } from 'astro';
import { setShellModuleEnabled } from '../../../../../core/services/shell-service';
import { jsonResponse } from '../../../../../shared/lib/http';

export const POST: APIRoute = async ({ params }) => {
  const widgetId = params.id;
  if (!widgetId) {
    return jsonResponse({ error: 'Missing widgetId.' }, 400);
  }

  const result = await setShellModuleEnabled(widgetId, true);

  if (!result.ok) {
    return jsonResponse({ error: result.message, notReadyReasons: result.notReadyReasons ?? [] }, result.status);
  }

  return jsonResponse({ module: result.module });
};

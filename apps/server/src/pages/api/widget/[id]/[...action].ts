import type { APIRoute } from 'astro';
import { resolveWidgetHandler } from '../../../../core/registry/registry';
import { listShellModules } from '../../../../core/services/shell-service';
import { jsonResponse } from '../../../../shared/lib/http';

async function handleRequest(method: string, request: Request, id: string | undefined, actionRaw: string | undefined) {
  if (!id) {
    return jsonResponse({ error: 'Missing widget id.' }, 400);
  }

  const action = typeof actionRaw === 'string' ? actionRaw : '';
  const actionSegments = action ? action.split('/').filter(Boolean) : [];

  const resolved = await resolveWidgetHandler(id, method, action);
  if (!resolved) {
    return jsonResponse({ error: `Route not found for widget ${id}.` }, 404);
  }

  const modules = await listShellModules();
  const moduleInfo = modules.find((entry) => entry.id === id);

  if (!moduleInfo) {
    return jsonResponse({ error: `Unknown widget: ${id}` }, 404);
  }

  if (!moduleInfo.ready) {
    return jsonResponse({
      error: 'Widget is not ready.',
      notReadyReasons: moduleInfo.notReadyReasons
    }, 409);
  }

  if (!moduleInfo.enabled) {
    return jsonResponse({
      error: 'Widget is disabled in shell settings.'
    }, 423);
  }

  return resolved.handler({
    request,
    action,
    actionSegments,
    params: {
      id
    }
  });
}

export const GET: APIRoute = async ({ request, params }) => {
  return handleRequest('GET', request, params.id, params.action);
};

export const POST: APIRoute = async ({ request, params }) => {
  return handleRequest('POST', request, params.id, params.action);
};

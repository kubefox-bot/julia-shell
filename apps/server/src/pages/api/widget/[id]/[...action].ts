import type { APIRoute } from 'astro';
import { resolveWidgetHandler } from '../../../../core/registry/registry';
import { listShellModules } from '../../../../core/services/shell-service';
import { resolvePassportRequestContext } from '../../../../domains/passport/server/context';
import { withSetCookie } from '../../../../domains/passport/server/cookie';
import { jsonResponse } from '../../../../shared/lib/http';

async function handleRequest(method: string, request: Request, id: string | undefined, actionRaw: string | undefined) {
  const resolvedAuth = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: true
  });

  if (!resolvedAuth.context) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  if (!id) {
    return jsonResponse({ error: 'Missing widget id.' }, 400);
  }

  const action = typeof actionRaw === 'string' ? actionRaw : '';
  const actionSegments = action ? action.split('/').filter(Boolean) : [];

  const resolved = await resolveWidgetHandler(id, method, action);
  if (!resolved) {
    return jsonResponse({ error: `Route not found for widget ${id}.` }, 404);
  }

  const modules = await listShellModules(resolvedAuth.context.agentId);
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

  const response = await resolved.handler({
    request,
    agentId: resolvedAuth.context.agentId,
    action,
    actionSegments,
    params: {
      id
    }
  });

  return withSetCookie(response, resolvedAuth.context.setCookieHeader);
}

export const GET: APIRoute = async ({ request, params }) => {
  return handleRequest('GET', request, params.id, params.action);
};

export const POST: APIRoute = async ({ request, params }) => {
  return handleRequest('POST', request, params.id, params.action);
};

import type { APIRoute } from 'astro';
import { resolveWidgetHandler } from '../../../../core/registry/registry';
import { listShellModules } from '../../../../core/services/shell-service';
import { PASSPORT_ANONYMOUS_AGENT_ID } from '@passport/server/config/consts';
import { resolvePassportRequestContext } from '@passport/server/context';
import { withSetCookie } from '@passport/server/cookie';
import { PASSPORT_HTTP_STATUS } from '@passport/server/http';
import { isPassportProtectedWidget } from '@passport/server/widget';
import { jsonResponse } from '../../../../shared/lib/http';

async function handleRequest(method: string, request: Request, id: string | undefined, actionRaw: string | undefined) {
  if (!id) {
    return jsonResponse({ error: 'Missing widget id.' }, PASSPORT_HTTP_STATUS.badRequest);
  }

  const requiresPassport = isPassportProtectedWidget(id);
  const resolvedAuth = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: false
  });
  const hasPassportAccess = Boolean(resolvedAuth.context);
  const agentId = resolvedAuth.context?.agentId ?? PASSPORT_ANONYMOUS_AGENT_ID;

  if (requiresPassport && !hasPassportAccess) {
    return jsonResponse({ error: 'Unauthorized.' }, PASSPORT_HTTP_STATUS.unauthorized);
  }

  const action = typeof actionRaw === 'string' ? actionRaw : '';
  const actionSegments = action ? action.split('/').filter(Boolean) : [];

  const resolved = await resolveWidgetHandler(id, method, action);
  if (!resolved) {
    return jsonResponse({ error: `Route not found for widget ${id}.` }, PASSPORT_HTTP_STATUS.notFound);
  }

  const modules = await listShellModules(agentId, { hasPassportAccess });
  const moduleInfo = modules.find((entry) => entry.id === id);

  if (!moduleInfo) {
    return jsonResponse({ error: `Unknown widget: ${id}` }, PASSPORT_HTTP_STATUS.notFound);
  }

  if (!moduleInfo.ready) {
    return jsonResponse({
      error: 'Widget is not ready.',
      notReadyReasons: moduleInfo.notReadyReasons
    }, PASSPORT_HTTP_STATUS.conflict);
  }

  if (!moduleInfo.enabled) {
    return jsonResponse({
      error: 'Widget is disabled in shell settings.'
    }, PASSPORT_HTTP_STATUS.locked);
  }

  const response = await resolved.handler({
    request,
    agentId,
    action,
    actionSegments,
    params: {
      id
    }
  });

  return withSetCookie(response, resolvedAuth.context?.setCookieHeader ?? null);
}

export const GET: APIRoute = async ({ request, params }) => {
  return handleRequest('GET', request, params.id, params.action);
};

export const POST: APIRoute = async ({ request, params }) => {
  return handleRequest('POST', request, params.id, params.action);
};

import type { APIRoute } from 'astro';
import { updateLayoutSettings } from '../../../../core/services/shell-service';
import { resolvePassportRequestContext } from '../../../../domains/passport/server/context';
import { withSetCookie } from '../../../../domains/passport/server/cookie';
import { jsonResponse, readJsonBody } from '../../../../shared/lib/http';

export const POST: APIRoute = async ({ request }) => {
  const resolvedAuth = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: true
  });
  if (!resolvedAuth.context) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const body = await readJsonBody<{
    desktopColumns?: number;
    mobileColumns?: number;
    locale?: 'system' | 'ru' | 'en';
    theme?: 'auto' | 'day' | 'night';
    layout?: Array<{ widgetId: string; order: number; size: 'small' | 'medium' | 'large' }>;
  }>(request);

  const result = await updateLayoutSettings({
    agentId: resolvedAuth.context.agentId,
    desktopColumns: body.desktopColumns,
    mobileColumns: body.mobileColumns,
    locale: body.locale,
    theme: body.theme,
    layout: body.layout
  });

  return withSetCookie(jsonResponse(result), resolvedAuth.context.setCookieHeader);
};

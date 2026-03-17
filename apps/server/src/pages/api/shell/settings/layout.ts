import type { APIRoute } from 'astro';
import { updateLayoutSettings } from '@core/services/shell-service';
import { PASSPORT_ANONYMOUS_AGENT_ID } from '@passport/server/config/consts';
import { resolvePassportRequestContext } from '@passport/server/context';
import { withSetCookie } from '@passport/server/cookie';
import { buildLocaleCookieHeader } from '@shared/lib/locale/cookie';
import { jsonResponse, readJsonBody } from '@shared/lib/http';

export const POST: APIRoute = async ({ request }) => {
  const resolvedAuth = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: false
  });
  const agentId = resolvedAuth.context?.agentId ?? PASSPORT_ANONYMOUS_AGENT_ID;

  const body = await readJsonBody<{
    desktopColumns?: number;
    mobileColumns?: number;
    locale?: 'ru' | 'en';
    theme?: 'auto' | 'day' | 'night';
    layout?: Array<{ widgetId: string; order: number; size: 'small' | 'medium' | 'large' }>;
  }>(request);

  const result = await updateLayoutSettings({
    agentId,
    desktopColumns: body.desktopColumns,
    mobileColumns: body.mobileColumns,
    locale: body.locale,
    theme: body.theme,
    layout: body.layout
  });

  const response = withSetCookie(jsonResponse(result), resolvedAuth.context?.setCookieHeader ?? null);
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', buildLocaleCookieHeader({ locale: result.layoutSettings.locale, request }));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

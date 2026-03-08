import type { APIRoute } from 'astro';
import { updateLayoutSettings } from '../../../../core/services/shell-service';
import { jsonResponse, readJsonBody } from '../../../../shared/lib/http';

export const POST: APIRoute = async ({ request }) => {
  const body = await readJsonBody<{
    desktopColumns?: number;
    mobileColumns?: number;
    locale?: 'system' | 'ru' | 'en';
    theme?: 'auto' | 'day' | 'night';
    layout?: Array<{ widgetId: string; order: number; size: 'small' | 'medium' | 'large' }>;
  }>(request);

  const result = await updateLayoutSettings({
    desktopColumns: body.desktopColumns,
    mobileColumns: body.mobileColumns,
    locale: body.locale,
    theme: body.theme,
    layout: body.layout
  });

  return jsonResponse(result);
};

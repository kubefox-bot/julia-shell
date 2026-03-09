import type { APIRoute } from 'astro'
import { resolvePassportRequestContext } from '../../../../domains/passport/server/context'
import { PASSPORT_HTTP_STATUS } from '../../../../domains/passport/server/http'
import { resolvePassportWidgetProviderSnapshot } from '../../../../domains/passport/server/widget-provider'
import { jsonResponse } from '../../../../shared/lib/http'

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url)
  const widgetId = url.searchParams.get('widget_id')?.trim() ?? ''

  if (!widgetId) {
    return jsonResponse({ error: 'Missing widget_id.' }, PASSPORT_HTTP_STATUS.badRequest)
  }

  const resolved = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: false
  })

  const payload = resolvePassportWidgetProviderSnapshot(widgetId, resolved.context)
  return jsonResponse(payload, PASSPORT_HTTP_STATUS.ok)
}

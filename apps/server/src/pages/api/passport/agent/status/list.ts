import type { APIRoute } from 'astro'
import { resolvePassportRequestContext } from '@passport/server/context'
import { PASSPORT_HTTP_STATUS } from '@passport/server/http'
import { passportRuntime } from '@passport/server/runtime'
import { jsonResponse } from '@shared/lib/http'

export const GET: APIRoute = async ({ request }) => {
  const resolved = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: false,
  })

  return jsonResponse(
    {
      agents: passportRuntime.getOnlineAgentSnapshots(resolved.context?.agentId ?? null),
    },
    PASSPORT_HTTP_STATUS.ok
  )
}

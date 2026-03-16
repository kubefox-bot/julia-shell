import type { APIRoute } from 'astro'
import { buildPassportAccessCookie, withSetCookie } from '@passport/server/cookie'
import {
  passportErrorResponse,
  PASSPORT_HTTP_STATUS,
} from '@passport/server/http'
import { passportRuntime } from '@passport/server/runtime'
import { issuePassportBrowserAccess } from '@passport/server/service'
import {
  PASSPORT_VALIDATION_CATALOG,
  parseRequestBody,
} from '@passport/server/validation'
import { jsonResponse, readJsonBody } from '@shared/lib/http'

export const POST: APIRoute = async ({ request }) => {
  const body = await readJsonBody<unknown>(request)
  const parsedResult = parseRequestBody(
    PASSPORT_VALIDATION_CATALOG.connectAgent.schema,
    body
  )
  if (parsedResult.isErr()) {
    return passportErrorResponse(PASSPORT_VALIDATION_CATALOG.connectAgent.errorKey)
  }

  const parsed = parsedResult.unwrap()
  const onlineAgent = passportRuntime.getOnlineAgentSession(parsed.agent_id)
  if (!onlineAgent) {
    return passportErrorResponse('agentUnavailable')
  }

  const issued = await issuePassportBrowserAccess(parsed.agent_id)
  const response = jsonResponse(
    passportRuntime.getAgentStatusSnapshot(parsed.agent_id),
    PASSPORT_HTTP_STATUS.ok
  )

  return withSetCookie(
    response,
    buildPassportAccessCookie({
      token: issued.accessJwt,
      request,
    })
  )
}

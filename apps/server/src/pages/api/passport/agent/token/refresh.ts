import type { APIRoute } from 'astro'
import { err, ok } from 'neverthrow'
import { passportErrorResponse } from '../../../../../domains/passport/server/http'
import { refreshPassportSession } from '../../../../../domains/passport/server/service'
import {
  PASSPORT_VALIDATION_CATALOG,
  parseRequestBody,
} from '../../../../../domains/passport/server/validation'
import { jsonResponse, readJsonBody } from '../../../../../shared/lib/http'

export const POST: APIRoute = async ({ request }) => {
  const body = await readJsonBody<unknown>(request)
  const parsedResult = parseRequestBody(PASSPORT_VALIDATION_CATALOG.refresh.schema, body)
  if (parsedResult.isErr()) {
    return passportErrorResponse(PASSPORT_VALIDATION_CATALOG.refresh.errorKey)
  }
  const parsed = parsedResult.value

  const refreshed = await refreshPassportSession({
    agentId: parsed.agent_id,
    refreshToken: parsed.refresh_token,
  })
  const refreshedResult = refreshed ? ok(refreshed) : err('refreshTokenInvalid' as const)

  return refreshedResult.match(
    (refreshed) =>
      jsonResponse({
        agent_id: refreshed.agentId,
        access_jwt: refreshed.accessJwt,
        refresh_token: refreshed.refreshToken,
        expires_in: refreshed.expiresIn,
      }),
    (errorKey) => passportErrorResponse(errorKey)
  )
}

import type { APIRoute } from 'astro'
import { passportErrorResponse } from '../../../../../domains/passport/server/http'
import { revokePassportSession } from '../../../../../domains/passport/server/service'
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

  const revoked = revokePassportSession({
    agentId: parsed.agent_id,
    refreshToken: parsed.refresh_token,
  })
  return jsonResponse({ revoked })
}

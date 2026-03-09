import type { APIRoute } from 'astro'
import { isPassportAdminAuthorized } from '@passport/server/config/admin-auth'
import {
  PASSPORT_HTTP_STATUS,
  passportErrorResponse,
} from '@passport/server/http'
import { createEnrollmentToken } from '@passport/server/repository'
import {
  PASSPORT_VALIDATION_CATALOG,
  parseRequestBody,
} from '@passport/server/validation'
import { jsonResponse, readJsonBody } from '../../../../../shared/lib/http'

export const POST: APIRoute = async ({ request }) => {
  if (!(await isPassportAdminAuthorized(request))) {
    return passportErrorResponse('unauthorized')
  }

  const body = await readJsonBody<unknown>(request)
  const parsedResult = parseRequestBody(
    PASSPORT_VALIDATION_CATALOG.createEnrollmentToken.schema,
    body
  )
  if (parsedResult.isErr()) {
    return passportErrorResponse(PASSPORT_VALIDATION_CATALOG.createEnrollmentToken.errorKey)
  }
  const parsed = parsedResult.value

  const created = createEnrollmentToken({
    agentId: parsed.agent_id,
    ttlMinutes: parsed.ttl_minutes,
    uses: parsed.uses,
    label: parsed.label,
  })

  return jsonResponse(
    {
      agent_id: created.agentId,
      token_id: created.tokenId,
      enrollment_token: created.enrollmentToken,
      expires_at: created.expiresAt,
      uses: created.uses,
    },
    PASSPORT_HTTP_STATUS.created
  )
}

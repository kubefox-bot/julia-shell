import type { APIRoute } from 'astro'
import { isPassportAdminAuthorized } from '../../../../../domains/passport/server/admin-auth'
import { passportErrorResponse } from '../../../../../domains/passport/server/http'
import { revokeEnrollmentToken } from '../../../../../domains/passport/server/repository'
import {
  PASSPORT_VALIDATION_CATALOG,
  parseRequestBody,
} from '../../../../../domains/passport/server/validation'
import { jsonResponse, readJsonBody } from '../../../../../shared/lib/http'

export const POST: APIRoute = async ({ request }) => {
  if (!(await isPassportAdminAuthorized(request))) {
    return passportErrorResponse('unauthorized')
  }

  const body = await readJsonBody<unknown>(request)
  const parsedResult = parseRequestBody(
    PASSPORT_VALIDATION_CATALOG.revokeEnrollmentToken.schema,
    body
  )
  if (parsedResult.isErr()) {
    return passportErrorResponse(PASSPORT_VALIDATION_CATALOG.revokeEnrollmentToken.errorKey)
  }
  const parsed = parsedResult.value

  const revoked = revokeEnrollmentToken(parsed.token_id)
  return jsonResponse({ revoked })
}

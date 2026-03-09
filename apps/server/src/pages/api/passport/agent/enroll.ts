import type { APIRoute } from 'astro'
import { err, ok } from 'neverthrow'
import { passportErrorResponse } from '@passport/server/http'
import { enrollPassportAgent } from '@passport/server/service'
import {
  PASSPORT_VALIDATION_CATALOG,
  parseRequestBody,
} from '@passport/server/validation'
import { jsonResponse, readJsonBody } from '@shared/lib/http'

export const POST: APIRoute = async ({ request }) => {
  const body = await readJsonBody<unknown>(request)
  const parsedResult = parseRequestBody(PASSPORT_VALIDATION_CATALOG.enroll.schema, body)
  if (parsedResult.isErr()) {
    return passportErrorResponse(PASSPORT_VALIDATION_CATALOG.enroll.errorKey)
  }
  const parsed = parsedResult.value

  const enrolled = await enrollPassportAgent({
    agentId: parsed.agent_id,
    enrollmentToken: parsed.enrollment_token,
    deviceInfo: parsed.device_info?.trim() || 'agent',
    agentVersion: parsed.agent_version?.trim() || 'unknown',
    capabilities: parsed.capabilities,
  })
  const enrolledResult = enrolled ? ok(enrolled) : err('enrollmentTokenInvalid' as const)

  return enrolledResult.match(
    (enrolled) =>
      jsonResponse({
        agent_id: enrolled.agentId,
        access_jwt: enrolled.accessJwt,
        refresh_token: enrolled.refreshToken,
        expires_in: enrolled.expiresIn,
      }),
    (errorKey) => passportErrorResponse(errorKey)
  )
}

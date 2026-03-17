import type { APIRoute } from 'astro'
import { match } from 'oxide.ts'
import { passportErrorResponse } from '@passport/server/http'
import { revokePassportSession } from '@passport/server/service'
import {
  PASSPORT_VALIDATION_CATALOG,
  parseRequestBody,
} from '@passport/server/validation'
import { jsonResponse, readJsonBody } from '@shared/lib/http'

export const POST: APIRoute = async ({ request }) => {
  const body = await readJsonBody<unknown>(request)
  const parsedResult = parseRequestBody(PASSPORT_VALIDATION_CATALOG.refresh.schema, body)

  return match(parsedResult, {
    Ok: (parsed) => {
      const revoked = revokePassportSession({
        agentId: parsed.agent_id,
        refreshToken: parsed.refresh_token,
      })

      return jsonResponse({ revoked })
    },
    Err: () => passportErrorResponse(PASSPORT_VALIDATION_CATALOG.refresh.errorKey)
  })
}

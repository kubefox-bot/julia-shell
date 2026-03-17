import type { APIRoute } from 'astro'
import { Option, match } from 'oxide.ts'
import { passportErrorResponse } from '@passport/server/http'
import { refreshPassportSession } from '@passport/server/service'
import {
  PASSPORT_VALIDATION_CATALOG,
  parseRequestBody,
} from '@passport/server/validation'
import { jsonResponse, readJsonBody } from '@shared/lib/http'

export const POST: APIRoute = async ({ request }) => {
  const body = await readJsonBody<unknown>(request)
  const parsedResult = parseRequestBody(PASSPORT_VALIDATION_CATALOG.refresh.schema, body)

  return match(parsedResult, {
    Ok: async (parsed) => {
      const refreshed = await refreshPassportSession({
        agentId: parsed.agent_id,
        refreshToken: parsed.refresh_token,
      })

      return match(Option.from(refreshed), {
        Some: (session) =>
          jsonResponse({
            agent_id: session.agentId,
            access_jwt: session.accessJwt,
            refresh_token: session.refreshToken,
            expires_in: session.expiresIn,
          }),
        None: () => passportErrorResponse('refreshTokenInvalid')
      })
    },
    Err: async () => passportErrorResponse(PASSPORT_VALIDATION_CATALOG.refresh.errorKey)
  })
}

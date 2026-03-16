import type grpc from '@grpc/grpc-js'
import { nowIso, nowMillis } from '@shared/lib/time'
import { resolvePassportJwtSecret } from '../config/jwt-secret'
import { verifyAccessJwt } from '../jwt'
import { PROTOCOL_VERSION, UNAUTHORIZED_MESSAGE } from './runtime-constants'
import type { RuntimeEnvelope, UnauthorizedState } from './runtime-types'

export function getAccessJwtFromEnvelope(envelope: RuntimeEnvelope) {
  return typeof envelope.accessJwt === 'string'
    ? envelope.accessJwt
    : typeof envelope.access_jwt === 'string'
      ? envelope.access_jwt
      : ''
}

export async function resolveAuthorizedEnvelope(envelope: RuntimeEnvelope) {
  const accessJwt = getAccessJwtFromEnvelope(envelope)
  if (!accessJwt) {
    return null
  }

  const secret = await resolvePassportJwtSecret()
  const claims = verifyAccessJwt(secret, accessJwt)
  if (!claims) {
    return null
  }

  return {
    claims,
    accessJwt,
  }
}

export function writeUnauthorized(
  call: grpc.ServerDuplexStream<RuntimeEnvelope, RuntimeEnvelope>
): UnauthorizedState {
  const unauthorized: UnauthorizedState = {
    reason: UNAUTHORIZED_MESSAGE,
    updatedAt: nowIso(),
  }

  call.write({
    protocolVersion: PROTOCOL_VERSION,
    sessionId: '',
    jobId: '',
    timestampUnixMs: nowMillis(),
    error: {
      code: 'UNAUTHORIZED',
      message: UNAUTHORIZED_MESSAGE,
      retryable: false,
    },
  })

  return unauthorized
}


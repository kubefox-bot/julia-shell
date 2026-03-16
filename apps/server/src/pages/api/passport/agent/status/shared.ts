import { DateTime } from 'luxon'
import { err, ok } from 'neverthrow'
import type {
  PassportContextResolution,
} from '@passport/server/context'
import type { PassportStatusSnapshot } from '@passport/server/runtime'

const FALLBACK_NOW_ISO = '1970-01-01T00:00:00.000Z'

function resolveNowIso() {
  return DateTime.utc().toISO() ?? FALLBACK_NOW_ISO
}

function buildUnauthorizedSnapshot(): PassportStatusSnapshot {
  return {
    status: 'unauthorized',
    label: 'Unauthorized',
    updatedAt: resolveNowIso(),
    reason: 'Invalid browser access token.',
    hostname: null,
    agentId: null
  }
}

function buildDisconnectedSnapshot(): PassportStatusSnapshot {
  return {
    status: 'disconnected',
    label: 'Disconnected',
    updatedAt: resolveNowIso(),
    reason: 'No browser access token.',
    hostname: null,
    agentId: null
  }
}

export function resolveBrowserStatusPayload(
  resolved: PassportContextResolution,
  snapshotForAgent: (agentId: string) => PassportStatusSnapshot
) {
  const contextResult = resolved.context
    ? ok(resolved.context.agentId)
    : err(resolved.reason)

  return contextResult.match(
    (agentId) => snapshotForAgent(agentId),
    (reason) => {
      if (reason === 'invalid') {
        return buildUnauthorizedSnapshot()
      }

      return buildDisconnectedSnapshot()
    }
  )
}

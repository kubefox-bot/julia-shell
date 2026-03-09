import { DateTime } from 'luxon'
import { readRuntimeEnv } from '@/core/env'

/**
 * Resolves heartbeat timeout for live passport sessions.
 */
export function resolvePassportHeartbeatTimeoutMs() {
  return readRuntimeEnv().passportHeartbeatTimeoutMs
}

/**
 * Checks whether the heartbeat timestamp is stale.
 */
export function isStalePassportHeartbeat(input: {
  lastHeartbeatAt: string
  timeoutMs: number
  nowMs?: number
}) {
  const heartbeat = DateTime.fromISO(input.lastHeartbeatAt, { zone: 'utc' })
  if (!heartbeat.isValid) {
    return true
  }

  const nowMs = input.nowMs ?? Date.now()
  return nowMs - heartbeat.toMillis() > input.timeoutMs
}

export const resolveAgentHeartbeatTimeoutMs = resolvePassportHeartbeatTimeoutMs
export const isStaleHeartbeat = isStalePassportHeartbeat

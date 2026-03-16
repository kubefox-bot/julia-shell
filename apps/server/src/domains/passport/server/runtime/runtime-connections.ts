import { invalidateWidgetRegistryCache } from '@core/registry/registry'
import { nowIso, nowMillis, toIsoFromMillis } from '@shared/lib/time'
import { getAgentDisplayName, upsertAgentSession } from '../repository'
import { resolvePassportHeartbeatTimeoutMs } from '../config/health'
import { DEFAULT_SESSION_ID, PROTOCOL_VERSION } from './runtime-constants'
import { extractHeartbeatHostname } from './runtime-utils'
import type { AgentConnection, RuntimeEnvelope } from './runtime-types'

export function resolveSessionMeta(envelope: RuntimeEnvelope) {
  const sessionId =
    typeof envelope.sessionId === 'string' && envelope.sessionId
      ? envelope.sessionId
      : DEFAULT_SESSION_ID
  const jobId = typeof envelope.jobId === 'string' ? envelope.jobId : ''

  return {
    sessionId,
    jobId,
  }
}

export function touchConnection(input: {
  call: AgentConnection['call']
  current: AgentConnection | null
  agentId: string
  sessionId: string
  accessJwt: string
  nowMs: number
  connections: Map<string, AgentConnection>
}) {
  if (!input.current) {
    const created: AgentConnection = {
      agentId: input.agentId,
      sessionId: input.sessionId,
      call: input.call,
      connectedAt: nowIso(),
      lastSeenAtMs: input.nowMs,
      hostname: null,
      accessJwt: input.accessJwt,
    }

    input.connections.set(input.agentId, created)
    upsertAgentSession({
      sessionId: input.sessionId,
      agentId: input.agentId,
      status: 'online',
    })
    input.call.write({
      protocolVersion: PROTOCOL_VERSION,
      sessionId: input.sessionId,
      jobId: '',
      timestampUnixMs: nowMillis(),
      healthPing: {
        nonce: `connected-${input.sessionId}`,
      },
    })
    invalidateWidgetRegistryCache()

    return created
  }

  input.current.lastSeenAtMs = input.nowMs
  input.current.accessJwt = input.accessJwt

  if (input.current.sessionId !== input.sessionId) {
    input.current.sessionId = input.sessionId
    upsertAgentSession({
      sessionId: input.sessionId,
      agentId: input.agentId,
      status: 'online',
    })
  }

  if (input.connections.get(input.agentId) !== input.current) {
    input.connections.set(input.agentId, input.current)
    invalidateWidgetRegistryCache()
  }

  return input.current
}

export function handleHeartbeatEnvelope(envelope: RuntimeEnvelope, connection: AgentConnection) {
  if (!envelope.heartbeat) {
    return false
  }

  const heartbeatHostname = extractHeartbeatHostname(envelope.heartbeat)
  if (heartbeatHostname && connection.hostname !== heartbeatHostname) {
    connection.hostname = heartbeatHostname
  }

  return true
}

export function markConnectionDisconnected(connection: AgentConnection, connections: Map<string, AgentConnection>, reason: string) {
  upsertAgentSession({
    sessionId: connection.sessionId,
    agentId: connection.agentId,
    status: 'disconnected',
    disconnectReason: reason,
  })
  connections.delete(connection.agentId)
  invalidateWidgetRegistryCache()
}

export function reconcileStaleSessions(connections: Map<string, AgentConnection>) {
  const nowMs = nowMillis()
  const timeoutMs = resolvePassportHeartbeatTimeoutMs()
  let shouldInvalidateRegistry = false

  for (const [agentId, connection] of connections) {
    if (nowMs - connection.lastSeenAtMs <= timeoutMs) {
      continue
    }

    upsertAgentSession({
      sessionId: connection.sessionId,
      agentId: connection.agentId,
      status: 'disconnected',
      disconnectReason: 'heartbeat_timeout',
    })
    try {
      connection.call.end()
    } catch {
      // ignored: stream may already be closed by transport
    }
    connections.delete(agentId)
    shouldInvalidateRegistry = true
  }

  if (shouldInvalidateRegistry) {
    invalidateWidgetRegistryCache()
  }
}

export function getOnlineAgentSessionFromConnections(connections: Map<string, AgentConnection>, agentId?: string | null) {
  const fromMemory = agentId
    ? connections.get(agentId) ?? null
    : [...connections.values()][0] ?? null
  if (!fromMemory) {
    return null
  }

  return {
    agentId: fromMemory.agentId,
    sessionId: fromMemory.sessionId,
    connectedAt: fromMemory.connectedAt,
    lastHeartbeatAt: toIsoFromMillis(fromMemory.lastSeenAtMs),
    hostname: fromMemory.hostname,
    accessJwt: fromMemory.accessJwt,
  }
}

export function getOnlineAgentSnapshotsFromConnections(
  connections: Map<string, AgentConnection>,
  currentAgentId?: string | null
) {
  return [...connections.values()]
    .map((connection) => ({
      agentId: connection.agentId,
      sessionId: connection.sessionId,
      displayName: getAgentDisplayName(connection.agentId),
      hostname: connection.hostname,
      connectedAt: connection.connectedAt,
      lastHeartbeatAt: toIsoFromMillis(connection.lastSeenAtMs),
      isCurrent: connection.agentId === (currentAgentId?.trim() || null),
    }))
    .sort((left, right) => {
      if (left.isCurrent !== right.isCurrent) {
        return left.isCurrent ? -1 : 1
      }

      const leftLabel = (left.displayName || left.hostname || left.agentId).toLowerCase()
      const rightLabel = (right.displayName || right.hostname || right.agentId).toLowerCase()
      return leftLabel.localeCompare(rightLabel, 'ru')
    })
}


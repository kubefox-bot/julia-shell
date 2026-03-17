import type grpc from '@grpc/grpc-js'
import { moduleBus } from '@shared/lib/bus'
import { nowMillis } from '@shared/lib/time'
import { appendAgentEvent } from '../repository'
import { resolveAuthorizedEnvelope, writeUnauthorized } from './runtime-auth'
import { handleHeartbeatEnvelope, markConnectionDisconnected, resolveSessionMeta, touchConnection } from './runtime-connections'
import { resolveWidgetEvent } from './runtime-widget-events'
import type { AgentConnection, RuntimeEnvelope, UnauthorizedState } from './runtime-types'

export function publishWidgetPayload(input: {
  agentId: string
  sessionId: string
  jobId: string
  widgetId: string
  eventType: string
  payload: unknown
}) {
  appendAgentEvent({
    agentId: input.agentId,
    sessionId: input.sessionId,
    jobId: input.jobId,
    eventType: `${input.widgetId}:${input.eventType}`,
    payload: input.payload,
  })

  moduleBus.publish(`agent:widget:${input.widgetId}:${input.jobId}`, `agent/${input.agentId}`, {
    type: input.eventType,
    widgetId: input.widgetId,
    jobId: input.jobId,
    payload: input.payload,
  })
}

function handleWidgetPayloads(input: {
  envelope: RuntimeEnvelope
  agentId: string
  sessionId: string
  jobId: string
}) {
  const resolved = resolveWidgetEvent(input.envelope)
  if (!resolved) {
    return
  }

  publishWidgetPayload({
    agentId: input.agentId,
    sessionId: input.sessionId,
    jobId: input.jobId,
    widgetId: resolved.widgetId,
    eventType: resolved.eventType,
    payload: resolved.payload,
  })
}

async function handleIncomingEnvelope(input: {
  call: grpc.ServerDuplexStream<RuntimeEnvelope, RuntimeEnvelope>
  envelope: RuntimeEnvelope
  currentConnection: AgentConnection | null
  connections: Map<string, AgentConnection>
  setUnauthorizedState: (value: UnauthorizedState) => void
}) {
  const authorized = await resolveAuthorizedEnvelope(input.envelope)
  if (!authorized) {
    input.setUnauthorizedState(writeUnauthorized(input.call))
    return input.currentConnection
  }

  const { claims, accessJwt } = authorized
  const { sessionId, jobId } = resolveSessionMeta(input.envelope)
  const nowMs = nowMillis()

  input.setUnauthorizedState(null)

  const connection = touchConnection({
    call: input.call,
    current: input.currentConnection,
    agentId: claims.sub,
    sessionId,
    accessJwt,
    nowMs,
    connections: input.connections,
  })

  if (handleHeartbeatEnvelope(input.envelope, connection)) {
    return connection
  }

  handleWidgetPayloads({
    envelope: input.envelope,
    agentId: claims.sub,
    sessionId,
    jobId,
  })

  return connection
}

export function handleConnectStream(input: {
  call: grpc.ServerDuplexStream<RuntimeEnvelope, RuntimeEnvelope>
  connections: Map<string, AgentConnection>
  setUnauthorizedState: (value: UnauthorizedState) => void
}) {
  let connection: AgentConnection | null = null

  input.call.on('data', async (envelope) => {
    try {
      connection = await handleIncomingEnvelope({
        call: input.call,
        envelope,
        currentConnection: connection,
        connections: input.connections,
        setUnauthorizedState: input.setUnauthorizedState,
      })
    } catch {
      if (connection) {
        markConnectionDisconnected(connection, input.connections, 'stream_error')
      }
    }
  })

  input.call.on('end', () => {
    if (connection) {
      markConnectionDisconnected(connection, input.connections, 'stream_end')
    }

    input.call.end()
  })

  input.call.on('error', () => {
    if (connection) {
      markConnectionDisconnected(connection, input.connections, 'stream_error')
    }
  })
}

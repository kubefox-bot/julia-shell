// biome-ignore lint/nursery/noExcessiveLinesPerFile: Stream runtime stays cohesive until next extraction pass.
import grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import { readRuntimeEnv } from '@/core/env'
import { invalidateWidgetRegistryCache } from '@/core/registry/registry'
import { moduleBus } from '@shared/lib/module-bus'
import { nowIso } from '@shared/lib/time'
import { resolvePassportJwtSecret } from '../config/jwt-secret'
import { resolvePassportHeartbeatTimeoutMs } from '../config/health'
import { verifyAccessJwt } from '../jwt'
import { appendAgentEvent, getAgentDisplayName, upsertAgentSession } from '../repository'
import type { AgentConnection, RuntimeEnvelope, UnauthorizedState } from './runtime-types'
import { extractHeartbeatHostname, isAgentDevMode, resolveProtoPath } from './runtime-utils'
import { resolvePassportStatusSnapshot } from './status'

const PROTOCOL_VERSION = '1.0.0'
const DEFAULT_SESSION_ID = 'session'
const UNAUTHORIZED_MESSAGE = 'Invalid access token.'
const GRPC_BIND_HOST = '0.0.0.0'
const TRANSCRIBE_WIDGET_ID = 'com.yulia.transcribe'
const TERMINAL_AGENT_WIDGET_ID = 'com.yulia.terminal-agent'

type RuntimeWidgetEvent = {
  widgetId: string
  eventType: string
  payload: unknown
}

export class PassportRuntime {
  private _server: grpc.Server | null = null
  private startPromise: Promise<void> | null = null
  private readonly connections = new Map<string, AgentConnection>()
  private lastUnauthorized: UnauthorizedState = null

  async startOnce() {
    if (!this.startPromise) {
      this.startPromise = this.start()
    }

    return this.startPromise
  }

  private async start() {
    if (this._server) {
      return
    }

    const protoPath = resolveProtoPath()
    const packageDefinition = protoLoader.loadSync(protoPath, {
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      arrays: true,
    })

    const loaded = grpc.loadPackageDefinition(packageDefinition) as unknown as {
      julia: {
        agent: {
          v1: {
            AgentControlService: { service: grpc.ServiceDefinition }
          }
        }
      }
    }

    const service = loaded.julia.agent.v1.AgentControlService

    const server = new grpc.Server()
    server.addService(service.service, {
      StreamConnect: this.handleConnect.bind(this),
      streamConnect: this.handleConnect.bind(this),
    })

    const port = readRuntimeEnv().passportGrpcPort
    await new Promise<void>((resolve, reject) => {
      server.bindAsync(`${GRPC_BIND_HOST}:${port}`, grpc.ServerCredentials.createInsecure(), (error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })

    this._server = server
  }

  private getAccessJwtFromEnvelope(envelope: RuntimeEnvelope) {
    return typeof envelope.accessJwt === 'string'
      ? envelope.accessJwt
      : typeof envelope.access_jwt === 'string'
        ? envelope.access_jwt
        : ''
  }

  private async resolveAuthorizedEnvelope(envelope: RuntimeEnvelope) {
    const accessJwt = this.getAccessJwtFromEnvelope(envelope)
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

  private markUnauthorized(call: grpc.ServerDuplexStream<RuntimeEnvelope, RuntimeEnvelope>) {
    this.lastUnauthorized = {
      reason: UNAUTHORIZED_MESSAGE,
      updatedAt: nowIso(),
    }

    call.write({
      protocolVersion: PROTOCOL_VERSION,
      sessionId: '',
      jobId: '',
      timestampUnixMs: Date.now(),
      error: {
        code: 'UNAUTHORIZED',
        message: UNAUTHORIZED_MESSAGE,
        retryable: false,
      },
    })
  }

  private resolveSessionMeta(envelope: RuntimeEnvelope) {
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

  private touchConnection(input: {
    call: grpc.ServerDuplexStream<RuntimeEnvelope, RuntimeEnvelope>
    current: AgentConnection | null
    agentId: string
    sessionId: string
    accessJwt: string
    nowMs: number
  }) {
    if (!input.current) {
      const created: AgentConnection = {
        agentId: input.agentId,
        sessionId: input.sessionId,
        call: input.call,
        lastSeenAtMs: input.nowMs,
        hostname: null,
        accessJwt: input.accessJwt,
      }

      this.connections.set(input.agentId, created)
      upsertAgentSession({
        sessionId: input.sessionId,
        agentId: input.agentId,
        status: 'online',
      })
      input.call.write({
        protocolVersion: PROTOCOL_VERSION,
        sessionId: input.sessionId,
        jobId: '',
        timestampUnixMs: Date.now(),
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

    if (this.connections.get(input.agentId) !== input.current) {
      this.connections.set(input.agentId, input.current)
      invalidateWidgetRegistryCache()
    }

    return input.current
  }

  private handleHeartbeatEnvelope(envelope: RuntimeEnvelope, connection: AgentConnection) {
    if (!envelope.heartbeat) {
      return false
    }

    const heartbeatHostname = extractHeartbeatHostname(envelope.heartbeat)

    if (heartbeatHostname && connection.hostname !== heartbeatHostname) {
      connection.hostname = heartbeatHostname
    }

    return true
  }

  private publishWidgetPayload(input: {
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

  private resolveWidgetEvent(envelope: RuntimeEnvelope): RuntimeWidgetEvent | null {
    const widgetEvent = typeof envelope.widgetEvent === 'object' && envelope.widgetEvent !== null
      ? envelope.widgetEvent as Record<string, unknown>
      : null

    if (!widgetEvent) {
      return null
    }

    const widgetId = typeof widgetEvent.widgetId === 'string'
      ? widgetEvent.widgetId.trim()
      : typeof widgetEvent.widget_id === 'string'
        ? widgetEvent.widget_id.trim()
        : ''

    if (!widgetId) {
      return null
    }

    if (widgetEvent.transcribeProgress) {
      return {
        widgetId,
        eventType: 'progress',
        payload: widgetEvent.transcribeProgress,
      }
    }

    if (widgetEvent.transcribeToken) {
      return {
        widgetId,
        eventType: 'token',
        payload: widgetEvent.transcribeToken,
      }
    }

    if (widgetEvent.transcribeDone) {
      return {
        widgetId,
        eventType: 'done',
        payload: widgetEvent.transcribeDone,
      }
    }

    if (widgetEvent.transcribeError) {
      return {
        widgetId,
        eventType: 'error',
        payload: widgetEvent.transcribeError,
      }
    }

    if (widgetEvent.terminalAgentStatus) {
      return {
        widgetId,
        eventType: 'status',
        payload: widgetEvent.terminalAgentStatus,
      }
    }

    if (widgetEvent.terminalAgentAssistantChunk) {
      return {
        widgetId,
        eventType: 'assistant_chunk',
        payload: widgetEvent.terminalAgentAssistantChunk,
      }
    }

    if (widgetEvent.terminalAgentAssistantDone) {
      return {
        widgetId,
        eventType: 'assistant_done',
        payload: widgetEvent.terminalAgentAssistantDone,
      }
    }

    if (widgetEvent.terminalAgentResumeFailed) {
      return {
        widgetId,
        eventType: 'resume_failed',
        payload: widgetEvent.terminalAgentResumeFailed,
      }
    }

    if (widgetEvent.terminalAgentError) {
      return {
        widgetId,
        eventType: 'error',
        payload: widgetEvent.terminalAgentError,
      }
    }

    return null
  }

  private handleWidgetPayloads(input: {
    envelope: RuntimeEnvelope
    agentId: string
    sessionId: string
    jobId: string
  }) {
    const resolved = this.resolveWidgetEvent(input.envelope)
    if (!resolved) {
      return
    }

    this.publishWidgetPayload({
      agentId: input.agentId,
      sessionId: input.sessionId,
      jobId: input.jobId,
      widgetId: resolved.widgetId,
      eventType: resolved.eventType,
      payload: resolved.payload,
    })
  }

  private markConnectionDisconnected(connection: AgentConnection, reason: string) {
    upsertAgentSession({
      sessionId: connection.sessionId,
      agentId: connection.agentId,
      status: 'disconnected',
      disconnectReason: reason,
    })
    this.connections.delete(connection.agentId)
    invalidateWidgetRegistryCache()
  }

  private reconcileStaleSessions() {
    const nowMs = Date.now()
    const timeoutMs = resolvePassportHeartbeatTimeoutMs()
    let shouldInvalidateRegistry = false

    for (const [agentId, connection] of this.connections) {
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
      this.connections.delete(agentId)
      shouldInvalidateRegistry = true
    }

    if (shouldInvalidateRegistry) {
      invalidateWidgetRegistryCache()
    }
  }

  private async handleIncomingEnvelope(
    call: grpc.ServerDuplexStream<RuntimeEnvelope, RuntimeEnvelope>,
    envelope: RuntimeEnvelope,
    currentConnection: AgentConnection | null
  ) {
    const authorized = await this.resolveAuthorizedEnvelope(envelope)
    if (!authorized) {
      this.markUnauthorized(call)
      return currentConnection
    }

    const { claims, accessJwt } = authorized
    const { sessionId, jobId } = this.resolveSessionMeta(envelope)
    const nowMs = Date.now()

    this.lastUnauthorized = null

    const connection = this.touchConnection({
      call,
      current: currentConnection,
      agentId: claims.sub,
      sessionId,
      accessJwt,
      nowMs,
    })

    if (this.handleHeartbeatEnvelope(envelope, connection)) {
      return connection
    }

    this.handleWidgetPayloads({
      envelope,
      agentId: claims.sub,
      sessionId,
      jobId,
    })

    return connection
  }

  private handleConnect(call: grpc.ServerDuplexStream<RuntimeEnvelope, RuntimeEnvelope>) {
    let connection: AgentConnection | null = null

    call.on('data', async (envelope) => {
      try {
        connection = await this.handleIncomingEnvelope(call, envelope, connection)
      } catch {
        if (connection) {
          this.markConnectionDisconnected(connection, 'stream_error')
        }
      }
    })

    call.on('end', () => {
      if (connection) {
        this.markConnectionDisconnected(connection, 'stream_end')
      }

      call.end()
    })

    call.on('error', () => {
      if (connection) {
        this.markConnectionDisconnected(connection, 'stream_error')
      }
    })
  }

  getOnlineAgentSession() {
    this.reconcileStaleSessions()
    const fromMemory = [...this.connections.values()][0]
    if (!fromMemory) {
      return null
    }

    return {
      agentId: fromMemory.agentId,
      sessionId: fromMemory.sessionId,
      hostname: fromMemory.hostname,
      accessJwt: fromMemory.accessJwt,
    }
  }

  getUnauthorizedState() {
    return this.lastUnauthorized
  }

  getAgentStatusSnapshot() {
    const onlineSession = this.getOnlineAgentSession()
    return resolvePassportStatusSnapshot(
      {
        isDevMode: isAgentDevMode(),
        hasOnlineSession: Boolean(onlineSession),
        unauthorizedState: this.lastUnauthorized,
      },
      {
        agentId: onlineSession?.agentId ?? null,
        hostname: onlineSession
          ? onlineSession.hostname || getAgentDisplayName(onlineSession.agentId)
          : null,
      }
    )
  }

  retryStatusSnapshot() {
    return this.getAgentStatusSnapshot()
  }

  dispatchWidgetCommand(input: {
    agentId: string
    sessionId: string
    jobId: string
    widgetId: string
    command:
      | {
          kind: 'transcribe_start'
          folderPath: string
          filePaths: string[]
        }
      | {
          kind: 'transcribe_cancel'
          reason?: string
        }
      | {
          kind: 'terminal_agent_send_message'
          provider: 'codex' | 'gemini'
          message: string
          resumeRef?: string
          apiKey?: string
          commandPath: string
          commandArgs: string[]
          useShellFallback: boolean
          shellOverride?: string
        }
      | {
          kind: 'terminal_agent_reset_dialog'
          reason?: string
        }
  }) {
    this.reconcileStaleSessions()

    const connection = this.connections.get(input.agentId)
    if (!connection) {
      return false
    }

    let payload: Record<string, unknown>
    if (input.command.kind === 'transcribe_start') {
      payload = {
        transcribeStart: {
          folderPath: input.command.folderPath,
          filePaths: input.command.filePaths,
        },
      }
    } else if (input.command.kind === 'transcribe_cancel') {
      payload = {
        transcribeCancel: {
          reason: input.command.reason ?? '',
        },
      }
    } else if (input.command.kind === 'terminal_agent_send_message') {
      payload = {
        terminalAgentSendMessage: {
          provider: input.command.provider === 'codex' ? 1 : 2,
          message: input.command.message,
          resumeRef: input.command.resumeRef ?? '',
          apiKey: input.command.apiKey ?? '',
          commandPath: input.command.commandPath,
          commandArgs: input.command.commandArgs,
          useShellFallback: input.command.useShellFallback,
          shellOverride: input.command.shellOverride ?? '',
        },
      }
    } else {
      payload = {
        terminalAgentResetDialog: {
          reason: input.command.reason ?? '',
        },
      }
    }

    connection.call.write({
      protocolVersion: PROTOCOL_VERSION,
      sessionId: input.sessionId,
      jobId: input.jobId,
      timestampUnixMs: Date.now(),
      widgetCommand: {
        widgetId: input.widgetId,
        ...payload,
      },
    })

    return true
  }

  dispatchTranscribeStart(input: {
    agentId: string
    sessionId: string
    jobId: string
    folderPath: string
    filePaths: string[]
  }) {
    return this.dispatchWidgetCommand({
      agentId: input.agentId,
      sessionId: input.sessionId,
      jobId: input.jobId,
      widgetId: TRANSCRIBE_WIDGET_ID,
      command: {
        kind: 'transcribe_start',
        folderPath: input.folderPath,
        filePaths: input.filePaths,
      },
    })
  }

  dispatchTerminalAgentSendMessage(input: {
    agentId: string
    sessionId: string
    dialogId: string
    provider: 'codex' | 'gemini'
    message: string
    resumeRef?: string
    apiKey?: string
    commandPath: string
    commandArgs: string[]
    useShellFallback: boolean
    shellOverride?: string
  }) {
    return this.dispatchWidgetCommand({
      agentId: input.agentId,
      sessionId: input.sessionId,
      jobId: input.dialogId,
      widgetId: TERMINAL_AGENT_WIDGET_ID,
      command: {
        kind: 'terminal_agent_send_message',
        provider: input.provider,
        message: input.message,
        resumeRef: input.resumeRef,
        apiKey: input.apiKey,
        commandPath: input.commandPath,
        commandArgs: input.commandArgs,
        useShellFallback: input.useShellFallback,
        shellOverride: input.shellOverride,
      },
    })
  }

  dispatchTerminalAgentResetDialog(input: {
    agentId: string
    sessionId: string
    dialogId: string
    reason?: string
  }) {
    return this.dispatchWidgetCommand({
      agentId: input.agentId,
      sessionId: input.sessionId,
      jobId: input.dialogId,
      widgetId: TERMINAL_AGENT_WIDGET_ID,
      command: {
        kind: 'terminal_agent_reset_dialog',
        reason: input.reason,
      },
    })
  }
}

function getPassportRuntimeSingleton() {
  if (!globalThis.__juliaPassportRuntimeSingleton) {
    globalThis.__juliaPassportRuntimeSingleton = new PassportRuntime()
  }

  return globalThis.__juliaPassportRuntimeSingleton
}

export const passportRuntime = getPassportRuntimeSingleton()

// biome-ignore lint/nursery/noExcessiveLinesPerFile: Stream runtime stays cohesive until next extraction pass.
import grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import { readRuntimeEnv } from '../../../../core/env'
import { invalidateWidgetRegistryCache } from '../../../../core/registry/registry'
import { moduleBus } from '../../../../shared/lib/module-bus'
import { nowIso } from '../../../../shared/lib/time'
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

  private publishStreamPayload(input: {
    agentId: string
    sessionId: string
    jobId: string
    eventType: 'progress' | 'token' | 'done' | 'error'
    payload: unknown
  }) {
    appendAgentEvent({
      agentId: input.agentId,
      sessionId: input.sessionId,
      jobId: input.jobId,
      eventType: input.eventType,
      payload: input.payload,
    })

    moduleBus.publish(`agent:transcribe:${input.jobId}`, `agent/${input.agentId}`, {
      type: input.eventType,
      payload: input.payload,
    })
  }

  private handleStreamPayloads(input: {
    envelope: RuntimeEnvelope
    agentId: string
    sessionId: string
    jobId: string
  }) {
    if (input.envelope.progress) {
      this.publishStreamPayload({
        agentId: input.agentId,
        sessionId: input.sessionId,
        jobId: input.jobId,
        eventType: 'progress',
        payload: input.envelope.progress,
      })
      return
    }

    if (input.envelope.token) {
      this.publishStreamPayload({
        agentId: input.agentId,
        sessionId: input.sessionId,
        jobId: input.jobId,
        eventType: 'token',
        payload: input.envelope.token,
      })
      return
    }

    if (input.envelope.done) {
      this.publishStreamPayload({
        agentId: input.agentId,
        sessionId: input.sessionId,
        jobId: input.jobId,
        eventType: 'done',
        payload: input.envelope.done,
      })
      return
    }

    if (input.envelope.error) {
      this.publishStreamPayload({
        agentId: input.agentId,
        sessionId: input.sessionId,
        jobId: input.jobId,
        eventType: 'error',
        payload: input.envelope.error,
      })
    }
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

    this.handleStreamPayloads({
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

  dispatchTranscribeStart(input: {
    agentId: string
    sessionId: string
    jobId: string
    folderPath: string
    filePaths: string[]
  }) {
    this.reconcileStaleSessions()

    const connection = this.connections.get(input.agentId)
    if (!connection) {
      return false
    }

    connection.call.write({
      protocolVersion: PROTOCOL_VERSION,
      sessionId: input.sessionId,
      jobId: input.jobId,
      timestampUnixMs: Date.now(),
      transcribeStart: {
        folderPath: input.folderPath,
        filePaths: input.filePaths,
      },
    })

    return true
  }
}

function getPassportRuntimeSingleton() {
  if (!globalThis.__juliaPassportRuntimeSingleton) {
    globalThis.__juliaPassportRuntimeSingleton = new PassportRuntime()
  }

  return globalThis.__juliaPassportRuntimeSingleton
}

export const passportRuntime = getPassportRuntimeSingleton()

import grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import { readRuntimeEnv } from '@core/env'
import type { OnlineAgentSnapshot } from '../types'
import { getAgentDisplayName } from '../repository'
import { GRPC_BIND_HOST } from './runtime-constants'
import {
  buildTerminalAgentResetDialogDispatch,
  buildTerminalAgentSendMessageDispatch,
  buildTranscribeStartDispatch,
  dispatchWidgetCommandFromConnections,
  type RuntimeDispatchInput
} from './runtime-dispatch'
import {
  getOnlineAgentSessionFromConnections,
  getOnlineAgentSnapshotsFromConnections,
  reconcileStaleSessions
} from './runtime-connections'
import { handleConnectStream, publishWidgetPayload } from './runtime-stream'
import type { AgentConnection, RuntimeEnvelope, UnauthorizedState } from './runtime-types'
import { resolveProtoPath } from './runtime-utils'
import { resolveWidgetEvent } from './runtime-widget-events'
import { resolvePassportStatusSnapshot } from './status'

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

  private handleConnect(call: grpc.ServerDuplexStream<RuntimeEnvelope, RuntimeEnvelope>) {
    handleConnectStream({
      call,
      connections: this.connections,
      setUnauthorizedState: (value) => {
        this.lastUnauthorized = value
      },
    })
  }

  getOnlineAgentSession(agentId?: string | null) {
    reconcileStaleSessions(this.connections)
    return getOnlineAgentSessionFromConnections(this.connections, agentId)
  }

  getOnlineAgentSnapshots(currentAgentId?: string | null): OnlineAgentSnapshot[] {
    reconcileStaleSessions(this.connections)
    return getOnlineAgentSnapshotsFromConnections(this.connections, currentAgentId)
  }

  getUnauthorizedState() {
    return this.lastUnauthorized
  }

  getAgentStatusSnapshot(agentId?: string | null) {
    const selectedAgentId = agentId?.trim() || null
    const onlineSession = this.getOnlineAgentSession(selectedAgentId)
    return resolvePassportStatusSnapshot(
      {
        hasOnlineSession: Boolean(onlineSession),
        unauthorizedState: selectedAgentId ? null : this.lastUnauthorized,
      },
      {
        agentId: selectedAgentId ?? onlineSession?.agentId ?? null,
        hostname: onlineSession
          ? onlineSession.hostname || getAgentDisplayName(onlineSession.agentId)
          : selectedAgentId
            ? getAgentDisplayName(selectedAgentId)
            : null,
      }
    )
  }

  retryStatusSnapshot(agentId?: string | null) {
    return this.getAgentStatusSnapshot(agentId)
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
    reconcileStaleSessions(this.connections)
    return dispatchWidgetCommandFromConnections(this.connections, input)
  }

  dispatchTranscribeStart(input: {
    agentId: string
    sessionId: string
    jobId: string
    folderPath: string
    filePaths: string[]
  }) {
    return this.dispatchWidgetCommand(buildTranscribeStartDispatch(input) satisfies RuntimeDispatchInput)
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
    return this.dispatchWidgetCommand(buildTerminalAgentSendMessageDispatch(input) satisfies RuntimeDispatchInput)
  }

  dispatchTerminalAgentResetDialog(input: {
    agentId: string
    sessionId: string
    dialogId: string
    reason?: string
  }) {
    return this.dispatchWidgetCommand(buildTerminalAgentResetDialogDispatch(input) satisfies RuntimeDispatchInput)
  }

  resolveWidgetEvent(envelope: RuntimeEnvelope) {
    return resolveWidgetEvent(envelope)
  }

  publishWidgetPayload(input: {
    agentId: string
    sessionId: string
    jobId: string
    widgetId: string
    eventType: string
    payload: unknown
  }) {
    publishWidgetPayload(input)
  }
}

function getPassportRuntimeSingleton() {
  if (!globalThis.__juliaPassportRuntimeSingleton) {
    globalThis.__juliaPassportRuntimeSingleton = new PassportRuntime()
  }

  return globalThis.__juliaPassportRuntimeSingleton
}

export const passportRuntime = getPassportRuntimeSingleton()

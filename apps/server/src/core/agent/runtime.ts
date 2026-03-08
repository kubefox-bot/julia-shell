import fs from 'node:fs';
import path from 'node:path';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { moduleBus } from '../../shared/lib/module-bus';
import { appendAgentEvent, disconnectStaleOnlineSessions, upsertAgentSession } from './repository';
import { invalidateWidgetRegistryCache } from '../registry/registry';
import { verifyAccessJwt } from './jwt';
import { resolveAgentStatusSnapshot } from './status';
import { resolveAgentJwtSecret } from './config';
import { resolveAgentHeartbeatTimeoutMs } from './health';

type AgentConnection = {
  agentId: string;
  sessionId: string;
  call: grpc.ServerDuplexStream<Record<string, unknown>, Record<string, unknown>>;
  lastSeenAtMs: number;
};

type UnauthorizedState = {
  reason: string;
  updatedAt: string;
} | null;

function isAgentDevMode() {
  return process.env.JULIAAPP_AGENT_ENABLE_DEV === '1';
}

function resolveProtoPath() {
  const fromEnv = process.env.JULIAAPP_PROTOCOL_PROTO_PATH?.trim();
  const candidates = [
    fromEnv,
    path.join(process.cwd(), 'packages', 'protocol', 'proto', 'agent_control.proto'),
    path.join(process.cwd(), '..', '..', 'packages', 'protocol', 'proto', 'agent_control.proto'),
    path.join(process.cwd(), 'proto', 'agent_control.proto')
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('agent_control.proto is not found. Set JULIAAPP_PROTOCOL_PROTO_PATH.');
}

class AgentRuntime {
  private _server: grpc.Server | null = null;
  private startPromise: Promise<void> | null = null;
  private readonly connections = new Map<string, AgentConnection>();
  private lastUnauthorized: UnauthorizedState = null;

  async startOnce() {
    if (!this.startPromise) {
      this.startPromise = this.start();
    }

    return this.startPromise;
  }

  private async start() {
    if (this._server) {
      return;
    }

    const protoPath = resolveProtoPath();
    const packageDefinition = protoLoader.loadSync(protoPath, {
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      arrays: true
    });

    const loaded = grpc.loadPackageDefinition(packageDefinition) as unknown as {
      julia: {
        agent: {
          v1: {
            AgentControlService: { service: grpc.ServiceDefinition };
          };
        };
      };
    };

    const service = loaded.julia.agent.v1.AgentControlService;

    const server = new grpc.Server();
    server.addService(service.service, {
      StreamConnect: this.handleConnect.bind(this),
      streamConnect: this.handleConnect.bind(this)
    });

    const port = Number(process.env.JULIA_AGENT_GRPC_PORT ?? 50051);
    await new Promise<void>((resolve, reject) => {
      server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error) => {
        if (error) {
          reject(error);
          return;
        }

        server.start();
        resolve();
      });
    });

    this._server = server;
  }

  private async isEnvelopeAuthorized(envelope: Record<string, unknown>) {
    const accessJwt = typeof envelope.accessJwt === 'string'
      ? envelope.accessJwt
      : typeof envelope.access_jwt === 'string'
        ? envelope.access_jwt
        : '';
    if (!accessJwt) {
      return null;
    }

    const secret = await resolveAgentJwtSecret();
    return verifyAccessJwt(secret, accessJwt);
  }

  private reconcileStaleSessions() {
    const nowMs = Date.now();
    const timeoutMs = resolveAgentHeartbeatTimeoutMs();
    const cutoffIso = new Date(nowMs - timeoutMs).toISOString();
    let shouldInvalidateRegistry = false;

    for (const [agentId, connection] of this.connections) {
      if (nowMs - connection.lastSeenAtMs <= timeoutMs) {
        continue;
      }

      upsertAgentSession({
        sessionId: connection.sessionId,
        agentId: connection.agentId,
        status: 'disconnected',
        disconnectReason: 'heartbeat_timeout'
      });
      this.connections.delete(agentId);
      shouldInvalidateRegistry = true;
    }

    const staleDisconnected = disconnectStaleOnlineSessions({
      cutoffIso,
      reason: 'heartbeat_timeout'
    });
    if (staleDisconnected > 0) {
      shouldInvalidateRegistry = true;
    }

    if (shouldInvalidateRegistry) {
      invalidateWidgetRegistryCache();
    }

    return { cutoffIso };
  }

  private handleConnect(
    call: grpc.ServerDuplexStream<Record<string, unknown>, Record<string, unknown>>
  ) {
    let connection: AgentConnection | null = null;

    call.on('data', async (envelope) => {
      const claims = await this.isEnvelopeAuthorized(envelope);
      if (!claims) {
        this.lastUnauthorized = {
          reason: 'Invalid access token.',
          updatedAt: new Date().toISOString()
        };
        call.write({
          protocolVersion: '1.0.0',
          sessionId: '',
          jobId: '',
          timestampUnixMs: Date.now(),
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid access token.',
            retryable: false
          }
        });
        return;
      }

      const agentId = typeof envelope.agentId === 'string' ? envelope.agentId : claims.sub;
      const sessionId = typeof envelope.sessionId === 'string' && envelope.sessionId ? envelope.sessionId : 'session';
      const jobId = typeof envelope.jobId === 'string' ? envelope.jobId : '';
      const nowMs = Date.now();

      this.lastUnauthorized = null;

      if (!connection) {
        connection = { agentId, sessionId, call, lastSeenAtMs: nowMs };
        this.connections.set(agentId, connection);
        invalidateWidgetRegistryCache();
      } else {
        connection.lastSeenAtMs = nowMs;
      }

      upsertAgentSession({
        sessionId,
        agentId,
        status: 'online'
      });

      if (envelope.heartbeat) {
        appendAgentEvent({
          agentId,
          sessionId,
          eventType: 'heartbeat',
          payload: envelope.heartbeat
        });
        return;
      }

      if (envelope.progress) {
        appendAgentEvent({
          agentId,
          sessionId,
          jobId,
          eventType: 'progress',
          payload: envelope.progress
        });
        moduleBus.publish(`agent:transcribe:${jobId}`, `agent/${agentId}`, {
          type: 'progress',
          payload: envelope.progress
        });
        return;
      }

      if (envelope.token) {
        appendAgentEvent({
          agentId,
          sessionId,
          jobId,
          eventType: 'token',
          payload: envelope.token
        });
        moduleBus.publish(`agent:transcribe:${jobId}`, `agent/${agentId}`, {
          type: 'token',
          payload: envelope.token
        });
        return;
      }

      if (envelope.done) {
        appendAgentEvent({
          agentId,
          sessionId,
          jobId,
          eventType: 'done',
          payload: envelope.done
        });
        moduleBus.publish(`agent:transcribe:${jobId}`, `agent/${agentId}`, {
          type: 'done',
          payload: envelope.done
        });
        return;
      }

      if (envelope.error) {
        appendAgentEvent({
          agentId,
          sessionId,
          jobId,
          eventType: 'error',
          payload: envelope.error
        });
        moduleBus.publish(`agent:transcribe:${jobId}`, `agent/${agentId}`, {
          type: 'error',
          payload: envelope.error
        });
      }
    });

    call.on('end', () => {
      if (connection) {
        upsertAgentSession({
          sessionId: connection.sessionId,
          agentId: connection.agentId,
          status: 'disconnected',
          disconnectReason: 'stream_end'
        });
        this.connections.delete(connection.agentId);
        invalidateWidgetRegistryCache();
      }

      call.end();
    });

    call.on('error', () => {
      if (connection) {
        upsertAgentSession({
          sessionId: connection.sessionId,
          agentId: connection.agentId,
          status: 'disconnected',
          disconnectReason: 'stream_error'
        });
        this.connections.delete(connection.agentId);
        invalidateWidgetRegistryCache();
      }
    });
  }

  getOnlineAgentSession() {
    this.reconcileStaleSessions();

    const fromMemory = [...this.connections.values()][0];
    if (fromMemory) {
      return {
        agentId: fromMemory.agentId,
        sessionId: fromMemory.sessionId
      };
    }
    return null;
  }

  getUnauthorizedState() {
    return this.lastUnauthorized;
  }

  getAgentStatusSnapshot() {
    return resolveAgentStatusSnapshot({
      isDevMode: isAgentDevMode(),
      hasOnlineSession: Boolean(this.getOnlineAgentSession()),
      unauthorizedState: this.lastUnauthorized
    });
  }

  retryStatusSnapshot() {
    return this.getAgentStatusSnapshot();
  }

  dispatchTranscribeStart(input: {
    agentId: string;
    sessionId: string;
    jobId: string;
    folderPath: string;
    filePaths: string[];
  }) {
    this.reconcileStaleSessions();

    const connection = this.connections.get(input.agentId);
    if (!connection) {
      return false;
    }

    connection.call.write({
      protocolVersion: '1.0.0',
      sessionId: input.sessionId,
      jobId: input.jobId,
      timestampUnixMs: Date.now(),
      transcribeStart: {
        folderPath: input.folderPath,
        filePaths: input.filePaths
      }
    });

    return true;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __juliaAgentRuntimeSingleton: AgentRuntime | undefined;
}

function getAgentRuntimeSingleton() {
  if (!globalThis.__juliaAgentRuntimeSingleton) {
    globalThis.__juliaAgentRuntimeSingleton = new AgentRuntime();
  }

  return globalThis.__juliaAgentRuntimeSingleton;
}

export const agentRuntime = getAgentRuntimeSingleton();

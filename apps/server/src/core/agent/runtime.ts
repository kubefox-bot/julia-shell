import fs from 'node:fs';
import path from 'node:path';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { moduleBus } from '../../shared/lib/module-bus';
import { appendAgentEvent, getAnyOnlineAgentSession, upsertAgentSession } from './repository';
import { secrets } from '../secrets/secrets';
import { verifyAccessJwt } from './jwt';

type AgentConnection = {
  agentId: string;
  sessionId: string;
  call: grpc.ServerDuplexStream<Record<string, unknown>, Record<string, unknown>>;
};

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
    const accessJwt = typeof envelope.accessJwt === 'string' ? envelope.accessJwt : '';
    if (!accessJwt) {
      return null;
    }

    const secret = await secrets.get('AGENT_JWT_SECRET');
    if (!secret?.value) {
      return null;
    }

    return verifyAccessJwt(secret.value, accessJwt);
  }

  private handleConnect(
    call: grpc.ServerDuplexStream<Record<string, unknown>, Record<string, unknown>>
  ) {
    let connection: AgentConnection | null = null;

    call.on('data', async (envelope) => {
      const claims = await this.isEnvelopeAuthorized(envelope);
      if (!claims) {
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

      if (!connection) {
        connection = { agentId, sessionId, call };
        this.connections.set(agentId, connection);
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
      }
    });
  }

  getOnlineAgentSession() {
    const fromMemory = [...this.connections.values()][0];
    if (fromMemory) {
      return {
        agentId: fromMemory.agentId,
        sessionId: fromMemory.sessionId
      };
    }

    return getAnyOnlineAgentSession();
  }

  dispatchTranscribeStart(input: {
    agentId: string;
    sessionId: string;
    jobId: string;
    folderPath: string;
    filePaths: string[];
  }) {
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

export const agentRuntime = new AgentRuntime();

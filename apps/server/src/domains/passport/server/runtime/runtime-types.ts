import type grpc from '@grpc/grpc-js';

export type RuntimeEnvelope = Record<string, unknown>;

export type AgentConnection = {
  agentId: string;
  sessionId: string;
  call: grpc.ServerDuplexStream<RuntimeEnvelope, RuntimeEnvelope>;
  lastSeenAtMs: number;
  hostname: string | null;
  accessJwt: string;
};

export type UnauthorizedState = {
  reason: string;
  updatedAt: string;
} | null;

export type EnrollmentTokenRecord = {
  tokenId: string;
  agentId: string;
  label: string | null;
  usesTotal: number;
  usesLeft: number;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
};

export type AgentTokenRecord = {
  id: string;
  agentId: string;
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type OnlineAgentSessionRecord = {
  sessionId: string;
  agentId: string;
  status: string;
  connectedAt: string;
  lastHeartbeatAt: string;
};

export type CreateEnrollmentTokenInput = {
  ttlMinutes?: number;
  uses?: number;
  label?: string;
  agentId?: string;
};

export type RegisterAgentInput = {
  agentId: string;
  displayName: string;
  capabilities: unknown;
  version: string;
};

export type UpsertAgentSessionInput = {
  sessionId: string;
  agentId: string;
  status: string;
  disconnectReason?: string | null;
};

export type DisconnectStaleSessionsInput = {
  cutoffIso: string;
  reason?: string;
};

export type AppendAgentEventInput = {
  agentId: string;
  sessionId?: string | null;
  jobId?: string | null;
  eventType: string;
  payload: unknown;
};

/**
 * UI auth status mirrored from `/api/passport/agent/status`.
 */
export type PassportAuthStatus = 'connected' | 'unauthorized' | 'disconnected';

export type PassportStatusResponse = {
  status: PassportAuthStatus;
  label: string;
  updatedAt: string;
  reason?: string | null;
  hostname?: string | null;
  agentId?: string | null;
};

export type PassportOnlineAgent = {
  agentId: string;
  displayName?: string | null;
  hostname?: string | null;
  connectedAt: string;
  lastHeartbeatAt: string;
  isCurrent: boolean;
};

export type PassportOnlineAgentsResponse = {
  agents: PassportOnlineAgent[];
};

/**
 * Zustand state for the passport domain.
 */
export type PassportSliceState = {
  passportStatus: PassportStatusResponse | null;
  passportAgents: PassportOnlineAgent[];
  agentId: string | null;
  authStatus: PassportAuthStatus;
  hasAccessToken: boolean;
  lastSyncAt: string | null;
  error: string | null;
  passportLoading: boolean;
  passportBusy: boolean;
};

/**
 * Zustand actions for the passport domain.
 */
export type PassportSliceActions = {
  syncFromStatus: () => Promise<void>;
  syncOnlineAgents: () => Promise<void>;
  ensureCookie: () => Promise<void>;
  clearSessionState: () => void;
  retryStatus: () => Promise<void>;
  connectAgent: (agentId: string) => Promise<void>;
};

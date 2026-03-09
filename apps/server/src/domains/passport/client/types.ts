/**
 * UI auth status mirrored from `/api/passport/agent/status`.
 */
export type PassportAuthStatus = 'connected' | 'connected_dev' | 'unauthorized' | 'disconnected';

export type PassportStatusResponse = {
  status: PassportAuthStatus;
  label: string;
  updatedAt: string;
  reason?: string | null;
  hostname?: string | null;
  agentId?: string | null;
};

/**
 * Zustand state for the passport domain.
 */
export type PassportSliceState = {
  passportStatus: PassportStatusResponse | null;
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
  ensureCookie: () => Promise<void>;
  clearSessionState: () => void;
  retryStatus: () => Promise<void>;
};

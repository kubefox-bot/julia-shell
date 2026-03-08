export type AgentUiStatus = 'connected' | 'connected_dev' | 'unauthorized' | 'disconnected';

export type AgentStatusSnapshot = {
  status: AgentUiStatus;
  label: string;
  updatedAt: string;
  reason: string | null;
  hostname: string | null;
};

export function resolveAgentStatusSnapshot(input: {
  isDevMode: boolean;
  hasOnlineSession: boolean;
  unauthorizedState: { reason: string; updatedAt: string } | null;
}, meta?: { hostname?: string | null }) {
  const hostname = meta?.hostname?.trim() || null;
  if (input.isDevMode) {
    return {
      status: 'connected_dev',
      label: 'Connected (dev)',
      updatedAt: new Date().toISOString(),
      reason: null,
      hostname
    } satisfies AgentStatusSnapshot;
  }

  if (input.hasOnlineSession) {
    return {
      status: 'connected',
      label: 'Connected',
      updatedAt: new Date().toISOString(),
      reason: null,
      hostname
    } satisfies AgentStatusSnapshot;
  }

  if (input.unauthorizedState) {
    return {
      status: 'unauthorized',
      label: 'Unauthorized',
      updatedAt: input.unauthorizedState.updatedAt,
      reason: input.unauthorizedState.reason,
      hostname: null
    } satisfies AgentStatusSnapshot;
  }

  return {
    status: 'disconnected',
    label: 'Disconnected',
    updatedAt: new Date().toISOString(),
    reason: null,
    hostname: null
  } satisfies AgentStatusSnapshot;
}

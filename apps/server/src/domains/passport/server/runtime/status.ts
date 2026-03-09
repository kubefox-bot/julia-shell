import { nowIso } from '@shared/lib/time';

export type PassportUiStatus = 'connected' | 'connected_dev' | 'unauthorized' | 'disconnected';

export type PassportStatusSnapshot = {
  status: PassportUiStatus;
  label: string;
  updatedAt: string;
  reason: string | null;
  hostname: string | null;
  agentId: string | null;
};

/**
 * Resolves status payload shared by passport API and UI slice.
 */
export function resolvePassportStatusSnapshot(input: {
  isDevMode: boolean;
  hasOnlineSession: boolean;
  unauthorizedState: { reason: string; updatedAt: string } | null;
}, meta?: { hostname?: string | null; agentId?: string | null }) {
  const hostname = meta?.hostname?.trim() || null;
  const agentId = meta?.agentId?.trim() || null;

  if (input.isDevMode) {
    return {
      status: 'connected_dev',
      label: 'Connected (dev)',
      updatedAt: nowIso(),
      reason: null,
      hostname,
      agentId
    } satisfies PassportStatusSnapshot;
  }

  if (input.hasOnlineSession) {
    return {
      status: 'connected',
      label: 'Connected',
      updatedAt: nowIso(),
      reason: null,
      hostname,
      agentId
    } satisfies PassportStatusSnapshot;
  }

  if (input.unauthorizedState) {
    return {
      status: 'unauthorized',
      label: 'Unauthorized',
      updatedAt: input.unauthorizedState.updatedAt,
      reason: input.unauthorizedState.reason,
      hostname: null,
      agentId: null
    } satisfies PassportStatusSnapshot;
  }

  return {
    status: 'disconnected',
    label: 'Disconnected',
    updatedAt: nowIso(),
    reason: null,
    hostname: null,
    agentId: null
  } satisfies PassportStatusSnapshot;
}

import type { StateCreator } from 'zustand';
import {
  connectPassportAgent,
  fetchPassportOnlineAgents,
  fetchPassportStatus,
  retryPassportStatus
} from './api';
import { dispatchPassportStatusChanged } from './bus';
import {
  PASSPORT_DEFAULT_AUTH_STATUS,
  PASSPORT_RETRY_FAILED_MESSAGE,
  PASSPORT_SYNC_FAILED_MESSAGE
} from './consts';
import type {
  PassportSliceActions,
  PassportSliceState,
  PassportStatusResponse
} from './types';
import type { ShellStore } from '../../../app/shell/model/types';
import { nowIso } from '@shared/lib/time';

function shouldReloadShellOnStatusTransition(
  previous: PassportStatusResponse | null,
  next: PassportStatusResponse
) {
  return (
    previous?.status !== next.status ||
    (previous?.agentId ?? null) !== (next.agentId ?? null)
  );
}

function hasPassportStatusChanged(
  previous: PassportStatusResponse | null,
  next: PassportStatusResponse | null
): boolean {
  if (!previous || !next) {
    return previous !== next;
  }

  return (
    previous.status !== next.status ||
    (previous.reason ?? null) !== (next.reason ?? null) ||
    (previous.agentId ?? null) !== (next.agentId ?? null)
  );
}

/**
 * Zustand passport slice used by shell for auth/session reactivity.
 */
export type PassportSlice = PassportSliceState & PassportSliceActions;

function mapStatusToState(nextStatus: PassportStatusResponse) {
  return {
    passportStatus: nextStatus,
    agentId: nextStatus.agentId?.trim() || null,
    authStatus: nextStatus.status,
    hasAccessToken: Boolean(nextStatus.agentId?.trim()),
    lastSyncAt: nowIso(),
    error: null
  };
}

export const createPassportSlice: StateCreator<ShellStore, [], [], PassportSlice> = (set, get) => ({
  passportStatus: null,
  passportAgents: [],
  agentId: null,
  authStatus: PASSPORT_DEFAULT_AUTH_STATUS,
  hasAccessToken: false,
  lastSyncAt: null,
  error: null,
  passportLoading: true,
  passportBusy: false,
  syncFromStatus: async () => {
    set({ passportLoading: true, error: null });

    try {
      const previousSnapshot = get().passportStatus;
      const [nextStatus, nextAgents] = await Promise.all([
        fetchPassportStatus(),
        fetchPassportOnlineAgents()
      ]);

      set({
        ...mapStatusToState(nextStatus),
        passportAgents: nextAgents.agents,
        passportLoading: false,
        passportBusy: false
      });

      if (hasPassportStatusChanged(previousSnapshot, nextStatus)) {
        dispatchPassportStatusChanged({
          status: nextStatus.status,
          updatedAt: nextStatus.updatedAt,
          reason: nextStatus.reason ?? null
        });
      }

      if (shouldReloadShellOnStatusTransition(previousSnapshot, nextStatus)) {
        await get().loadShell();
      }
    } catch (error) {
      set({
        passportLoading: false,
        passportBusy: false,
        error: error instanceof Error ? error.message : PASSPORT_SYNC_FAILED_MESSAGE
      });
    }
  },
  ensureCookie: async () => {
    await get().syncFromStatus();
  },
  syncOnlineAgents: async () => {
    try {
      const nextAgents = await fetchPassportOnlineAgents();
      set({
        passportAgents: nextAgents.agents
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : PASSPORT_SYNC_FAILED_MESSAGE
      });
    }
  },
  clearSessionState: () => {
    set({
      passportStatus: null,
      passportAgents: [],
      agentId: null,
      authStatus: PASSPORT_DEFAULT_AUTH_STATUS,
      hasAccessToken: false,
      lastSyncAt: nowIso(),
      error: null,
      passportLoading: false,
      passportBusy: false
    });
  },
  retryStatus: async () => {
    set({ passportBusy: true, passportLoading: true, error: null });

    try {
      const previousSnapshot = get().passportStatus;
      const [nextStatus, nextAgents] = await Promise.all([
        retryPassportStatus(),
        fetchPassportOnlineAgents()
      ]);

      set({
        ...mapStatusToState(nextStatus),
        passportAgents: nextAgents.agents,
        passportBusy: false,
        passportLoading: false
      });

      if (hasPassportStatusChanged(previousSnapshot, nextStatus)) {
        dispatchPassportStatusChanged({
          status: nextStatus.status,
          updatedAt: nextStatus.updatedAt,
          reason: nextStatus.reason ?? null
        });
      }

      if (shouldReloadShellOnStatusTransition(previousSnapshot, nextStatus)) {
        await get().loadShell();
      }
    } catch (error) {
      set({
        passportBusy: false,
        passportLoading: false,
        error: error instanceof Error ? error.message : PASSPORT_RETRY_FAILED_MESSAGE
      });
    }
  },
  connectAgent: async (agentId: string) => {
    set({ passportBusy: true, passportLoading: true, error: null });

    try {
      const nextStatus = await connectPassportAgent(agentId);
      const nextAgents = await fetchPassportOnlineAgents();

      set({
        ...mapStatusToState(nextStatus),
        passportAgents: nextAgents.agents,
        passportBusy: false,
        passportLoading: false
      });

      dispatchPassportStatusChanged({
        status: nextStatus.status,
        updatedAt: nextStatus.updatedAt,
        reason: nextStatus.reason ?? null
      });

      await get().loadShell();
    } catch (error) {
      set({
        passportBusy: false,
        passportLoading: false,
        error: error instanceof Error ? error.message : PASSPORT_RETRY_FAILED_MESSAGE
      });
    }
  }
});

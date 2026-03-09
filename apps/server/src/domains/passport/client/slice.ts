import type { StateCreator } from 'zustand';
import { fetchPassportStatus, retryPassportStatus } from './api';
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
  previous: PassportStatusResponse['status'] | null | undefined,
  next: PassportStatusResponse['status'] | null | undefined
) {
  return previous !== next;
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
    hasAccessToken: nextStatus.status !== PASSPORT_DEFAULT_AUTH_STATUS,
    lastSyncAt: nowIso(),
    error: null
  };
}

export const createPassportSlice: StateCreator<ShellStore, [], [], PassportSlice> = (set, get) => ({
  passportStatus: null,
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
      const previousStatus = get().passportStatus?.status;
      const previousSnapshot = get().passportStatus;
      const nextStatus = await fetchPassportStatus();

      set({
        ...mapStatusToState(nextStatus),
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

      if (shouldReloadShellOnStatusTransition(previousStatus, nextStatus.status)) {
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
  clearSessionState: () => {
    set({
      passportStatus: null,
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
      const previousStatus = get().passportStatus?.status;
      const previousSnapshot = get().passportStatus;
      const nextStatus = await retryPassportStatus();

      set({
        ...mapStatusToState(nextStatus),
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

      if (shouldReloadShellOnStatusTransition(previousStatus, nextStatus.status)) {
        await get().loadShell();
      }
    } catch (error) {
      set({
        passportBusy: false,
        passportLoading: false,
        error: error instanceof Error ? error.message : PASSPORT_RETRY_FAILED_MESSAGE
      });
    }
  }
});

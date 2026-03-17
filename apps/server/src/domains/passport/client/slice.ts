import type { StateCreator } from 'zustand';
import { Result, match } from 'oxide.ts';
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

function toErrorMessage(error: Error, fallback: string) {
  return error.message || fallback;
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
    const shouldShowLoading = get().passportStatus === null;
    set({ passportLoading: shouldShowLoading, error: null });

    const previousSnapshot = get().passportStatus;
    const nextResult = await Result.safe(
      Promise.all([
        fetchPassportStatus(),
        fetchPassportOnlineAgents()
      ])
    );

    await match(nextResult, {
      Ok: async ([nextStatus, nextAgents]) => {
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
      },
      Err: async (error) => {
        set({
          passportLoading: false,
          passportBusy: false,
          error: toErrorMessage(error, PASSPORT_SYNC_FAILED_MESSAGE)
        });
      }
    });
  },
  ensureCookie: async () => {
    await get().syncFromStatus();
  },
  syncOnlineAgents: async () => {
    const nextResult = await Result.safe(fetchPassportOnlineAgents());

    match(nextResult, {
      Ok: (nextAgents) => {
        set({
          passportAgents: nextAgents.agents
        });
      },
      Err: (error) => {
        set({
          error: toErrorMessage(error, PASSPORT_SYNC_FAILED_MESSAGE)
        });
      }
    });
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

    const previousSnapshot = get().passportStatus;
    const nextResult = await Result.safe(
      Promise.all([
        retryPassportStatus(),
        fetchPassportOnlineAgents()
      ])
    );

    await match(nextResult, {
      Ok: async ([nextStatus, nextAgents]) => {
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
      },
      Err: async (error) => {
        set({
          passportBusy: false,
          passportLoading: false,
          error: toErrorMessage(error, PASSPORT_RETRY_FAILED_MESSAGE)
        });
      }
    });
  },
  connectAgent: async (agentId: string) => {
    set({ passportBusy: true, passportLoading: true, error: null });

    const connectResult = await Result.safe(connectPassportAgent(agentId));

    await match(connectResult, {
      Ok: async (nextStatus) => {
        const nextAgentsResult = await Result.safe(fetchPassportOnlineAgents());

        await match(nextAgentsResult, {
          Ok: async (nextAgents) => {
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
          },
          Err: async (error) => {
            set({
              passportBusy: false,
              passportLoading: false,
              error: toErrorMessage(error, PASSPORT_RETRY_FAILED_MESSAGE)
            });
          }
        });
      },
      Err: async (error) => {
        set({
          passportBusy: false,
          passportLoading: false,
          error: toErrorMessage(error, PASSPORT_RETRY_FAILED_MESSAGE)
        });
      }
    });
  }
});

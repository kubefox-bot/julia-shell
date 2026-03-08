import type { StateCreator } from 'zustand';
import { fetchAgentStatus, retryAgentStatus } from '../../lib/api';
import { dispatchAgentStatusChanged } from '../../lib/agent-status-bus';
import type { AgentStatusResponse, AgentStatusStoreActions, AgentStatusStoreState, AgentUiStatus } from '../types';
import type { ShellStore } from '../../../shell/model/types';

function isConnectedStatus(status: AgentUiStatus | null | undefined): boolean {
  return status === 'connected' || status === 'connected_dev';
}

function hasAgentStatusChanged(previous: AgentStatusResponse | null, next: AgentStatusResponse | null): boolean {
  if (!previous || !next) {
    return previous !== next;
  }

  return previous.status !== next.status || (previous.reason ?? null) !== (next.reason ?? null);
}

export type AgentStatusSlice = AgentStatusStoreState & AgentStatusStoreActions;

export const createAgentStatusSlice: StateCreator<ShellStore, [], [], AgentStatusSlice> = (set, get) => ({
  agentStatus: null,
  agentStatusLoading: true,
  agentStatusBusy: false,
  loadAgentStatus: async () => {
    set({ agentStatusLoading: true });

    try {
      const previousStatus = get().agentStatus?.status;
      const previousAgentStatus = get().agentStatus;
      const nextStatus = await fetchAgentStatus();
      set({ agentStatus: nextStatus, agentStatusLoading: false });

      if (hasAgentStatusChanged(previousAgentStatus, nextStatus)) {
        dispatchAgentStatusChanged({
          status: nextStatus.status,
          updatedAt: nextStatus.updatedAt,
          reason: nextStatus.reason ?? null
        });
      }

      if (isConnectedStatus(nextStatus.status) && !isConnectedStatus(previousStatus)) {
        await get().loadShell();
      }
    } catch {
      set({ agentStatusLoading: false });
    }
  },
  retryAgentConnection: async () => {
    set({ agentStatusBusy: true, agentStatusLoading: true });

    try {
      const previousStatus = get().agentStatus?.status;
      const previousAgentStatus = get().agentStatus;
      const nextStatus = await retryAgentStatus();
      set({ agentStatus: nextStatus, agentStatusBusy: false, agentStatusLoading: false });

      if (hasAgentStatusChanged(previousAgentStatus, nextStatus)) {
        dispatchAgentStatusChanged({
          status: nextStatus.status,
          updatedAt: nextStatus.updatedAt,
          reason: nextStatus.reason ?? null
        });
      }

      if (isConnectedStatus(nextStatus.status) && !isConnectedStatus(previousStatus)) {
        await get().loadShell();
      }
    } catch {
      set({ agentStatusBusy: false, agentStatusLoading: false });
    }
  }
});

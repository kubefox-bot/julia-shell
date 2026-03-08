export type AgentUiStatus = 'connected' | 'connected_dev' | 'unauthorized' | 'disconnected';

export type AgentStatusResponse = {
  status: AgentUiStatus;
  label: string;
  updatedAt: string;
  reason?: string | null;
};

export type AgentStatusStoreState = {
  agentStatus: AgentStatusResponse | null;
  agentStatusLoading: boolean;
  agentStatusBusy: boolean;
};

export type AgentStatusStoreActions = {
  loadAgentStatus: () => Promise<void>;
  retryAgentConnection: () => Promise<void>;
};

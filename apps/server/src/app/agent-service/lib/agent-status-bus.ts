import type { AgentUiStatus } from '../model/types';

export type AgentStatusChangedDetail = {
  status: AgentUiStatus;
  updatedAt: string;
  reason?: string | null;
};

export const AGENT_STATUS_CHANGED_EVENT = 'yulia:agent-status-changed';

export function dispatchAgentStatusChanged(detail: AgentStatusChangedDetail) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<AgentStatusChangedDetail>(AGENT_STATUS_CHANGED_EVENT, { detail }));
}

export function subscribeAgentStatusChanged(
  listener: (detail: AgentStatusChangedDetail) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<AgentStatusChangedDetail>;
    if (!customEvent.detail) {
      return;
    }

    listener(customEvent.detail);
  };

  window.addEventListener(AGENT_STATUS_CHANGED_EVENT, handler);
  return () => {
    window.removeEventListener(AGENT_STATUS_CHANGED_EVENT, handler);
  };
}

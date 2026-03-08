import type { AgentStatusResponse } from '../model/types';

async function safeJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { error?: string })?.error ?? `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function fetchAgentStatus() {
  const response = await fetch('/api/agent/status');
  return safeJson<AgentStatusResponse>(response);
}

export async function retryAgentStatus() {
  const response = await fetch('/api/agent/status/retry', {
    method: 'POST'
  });

  return safeJson<AgentStatusResponse>(response);
}

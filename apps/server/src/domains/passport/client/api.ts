import type {
  PassportOnlineAgentsResponse,
  PassportStatusResponse
} from './types';

async function safeJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { error?: string })?.error ?? `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

/**
 * Reads current passport status and performs cookie bootstrap on server side.
 */
export async function fetchPassportStatus() {
  const response = await fetch('/api/passport/agent/status');
  return safeJson<PassportStatusResponse>(response);
}

export async function fetchPassportOnlineAgents() {
  const response = await fetch('/api/passport/agent/status/list');
  return safeJson<PassportOnlineAgentsResponse>(response);
}

export async function retryPassportStatus() {
  const response = await fetch('/api/passport/agent/status/retry', {
    method: 'POST'
  });

  return safeJson<PassportStatusResponse>(response);
}

export async function connectPassportAgent(agentId: string) {
  const response = await fetch('/api/passport/agent/status/connect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agent_id: agentId
    })
  });

  return safeJson<PassportStatusResponse>(response);
}

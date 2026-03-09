import type { PassportStatusResponse } from './types';

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

export async function retryPassportStatus() {
  const response = await fetch('/api/passport/agent/status/retry', {
    method: 'POST'
  });

  return safeJson<PassportStatusResponse>(response);
}

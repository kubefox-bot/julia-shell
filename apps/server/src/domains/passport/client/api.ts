import type {
  PassportOnlineAgentsResponse,
  PassportStatusResponse
} from './types';
import { unwrapResultAsync } from '@shared/lib/result';
import { defineQuery, requestJsonResult } from '@shared/lib/request';

export const passportQueryKeys = {
  status: () => ['passport', 'status'] as const,
  onlineAgents: () => ['passport', 'online-agents'] as const
};

/**
 * Reads current passport status and performs cookie bootstrap on server side.
 */
export async function fetchPassportStatus() {
  return unwrapResultAsync(requestJsonResult<PassportStatusResponse>('/api/passport/agent/status'));
}

export async function fetchPassportOnlineAgents() {
  return unwrapResultAsync(requestJsonResult<PassportOnlineAgentsResponse>('/api/passport/agent/status/list'));
}

export async function retryPassportStatus() {
  return unwrapResultAsync(requestJsonResult<PassportStatusResponse>('/api/passport/agent/status/retry', {
    method: 'POST'
  }));
}

export async function connectPassportAgent(agentId: string) {
  return unwrapResultAsync(requestJsonResult<PassportStatusResponse>('/api/passport/agent/status/connect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agent_id: agentId
    })
  }));
}

export const passportStatusQuery = defineQuery(passportQueryKeys.status(), fetchPassportStatus);
export const passportOnlineAgentsQuery = defineQuery(passportQueryKeys.onlineAgents(), fetchPassportOnlineAgents);

import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../shared/lib/http';
import { agentRuntime } from '../../../core/agent/runtime';

export const GET: APIRoute = async () => {
  return jsonResponse(agentRuntime.getAgentStatusSnapshot(), 200);
};

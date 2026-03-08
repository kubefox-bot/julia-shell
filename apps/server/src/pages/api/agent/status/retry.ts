import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../../shared/lib/http';
import { agentRuntime } from '../../../../core/agent/runtime';

export const POST: APIRoute = async () => {
  return jsonResponse(agentRuntime.retryStatusSnapshot(), 200);
};

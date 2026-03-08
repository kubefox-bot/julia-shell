import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../shared/lib/http';

export const POST: APIRoute = async () => {
  return jsonResponse({
    error: 'Use gRPC channel for this endpoint.',
    hint: 'Connect to JULIA_AGENT_GRPC_PORT using AgentControlService.Connect stream.'
  }, 426);
};

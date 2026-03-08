import type { MiddlewareHandler } from 'astro';
import { agentRuntime } from './core/agent/runtime';
import { preloadServerSecretsOnce } from './core/secrets/secrets';

const startupPromise = Promise.all([
  preloadServerSecretsOnce(),
  agentRuntime.startOnce()
]).then(() => undefined);

export const onRequest: MiddlewareHandler = async (_, next) => {
  await startupPromise;
  return next();
};

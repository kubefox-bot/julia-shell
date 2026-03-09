import type { MiddlewareHandler } from 'astro';
import { passportRuntime } from './domains/passport/server/runtime/runtime';
import { preloadServerSecretsOnce } from './core/secrets/secrets';

const startupPromise = Promise.all([
  preloadServerSecretsOnce(),
  passportRuntime.startOnce()
]).then(() => undefined);

export const onRequest: MiddlewareHandler = async (_, next) => {
  await startupPromise;
  return next();
};

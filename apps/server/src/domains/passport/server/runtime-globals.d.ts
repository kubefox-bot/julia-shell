import type { PassportRuntime } from './runtime';

declare global {
  // eslint-disable-next-line no-var
  var __juliaPassportRuntimeSingleton: PassportRuntime | undefined;
}

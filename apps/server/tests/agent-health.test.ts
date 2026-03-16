import { afterEach, describe, expect, it } from 'vitest';
import { isStaleHeartbeat, resolveAgentHeartbeatTimeoutMs } from '../src/domains/passport/server/config/health';

const ENV_KEY = 'JULIA_AGENT_HEARTBEAT_TIMEOUT_MS';
const DEFAULT_TIMEOUT_MS = 60_000;
const CONFIGURED_TIMEOUT_MS = 45_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 600_000;

describe('agent heartbeat healthcheck', () => {
  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it('uses default timeout when env is missing', () => {
    expect(resolveAgentHeartbeatTimeoutMs()).toBe(DEFAULT_TIMEOUT_MS);
  });

  it('uses configured timeout from env', () => {
    process.env[ENV_KEY] = '45000';
    expect(resolveAgentHeartbeatTimeoutMs()).toBe(CONFIGURED_TIMEOUT_MS);
  });

  it('clamps timeout to minimum', () => {
    process.env[ENV_KEY] = '1000';
    expect(resolveAgentHeartbeatTimeoutMs()).toBe(MIN_TIMEOUT_MS);
  });

  it('clamps timeout to maximum', () => {
    process.env[ENV_KEY] = '99999999';
    expect(resolveAgentHeartbeatTimeoutMs()).toBe(MAX_TIMEOUT_MS);
  });

  it('falls back to default for invalid env values', () => {
    process.env[ENV_KEY] = 'abc';
    expect(resolveAgentHeartbeatTimeoutMs()).toBe(DEFAULT_TIMEOUT_MS);
  });

  it('marks heartbeat as stale when age exceeds timeout', () => {
    const nowMs = Date.parse('2026-03-08T16:00:00.000Z');
    const lastHeartbeatAt = '2026-03-08T15:58:30.000Z';
    expect(isStaleHeartbeat({ lastHeartbeatAt, timeoutMs: DEFAULT_TIMEOUT_MS, nowMs })).toBe(true);
  });

  it('does not mark heartbeat as stale when within timeout', () => {
    const nowMs = Date.parse('2026-03-08T16:00:00.000Z');
    const lastHeartbeatAt = '2026-03-08T15:59:30.000Z';
    expect(isStaleHeartbeat({ lastHeartbeatAt, timeoutMs: DEFAULT_TIMEOUT_MS, nowMs })).toBe(false);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { isStaleHeartbeat, resolveAgentHeartbeatTimeoutMs } from '../src/core/agent/health';

const ENV_KEY = 'JULIA_AGENT_HEARTBEAT_TIMEOUT_MS';

describe('agent heartbeat healthcheck', () => {
  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it('uses default timeout when env is missing', () => {
    expect(resolveAgentHeartbeatTimeoutMs()).toBe(60_000);
  });

  it('uses configured timeout from env', () => {
    process.env[ENV_KEY] = '45000';
    expect(resolveAgentHeartbeatTimeoutMs()).toBe(45_000);
  });

  it('clamps timeout to minimum', () => {
    process.env[ENV_KEY] = '1000';
    expect(resolveAgentHeartbeatTimeoutMs()).toBe(5_000);
  });

  it('clamps timeout to maximum', () => {
    process.env[ENV_KEY] = '99999999';
    expect(resolveAgentHeartbeatTimeoutMs()).toBe(600_000);
  });

  it('falls back to default for invalid env values', () => {
    process.env[ENV_KEY] = 'abc';
    expect(resolveAgentHeartbeatTimeoutMs()).toBe(60_000);
  });

  it('marks heartbeat as stale when age exceeds timeout', () => {
    const nowMs = Date.parse('2026-03-08T16:00:00.000Z');
    const lastHeartbeatAt = '2026-03-08T15:58:30.000Z';
    expect(isStaleHeartbeat({ lastHeartbeatAt, timeoutMs: 60_000, nowMs })).toBe(true);
  });

  it('does not mark heartbeat as stale when within timeout', () => {
    const nowMs = Date.parse('2026-03-08T16:00:00.000Z');
    const lastHeartbeatAt = '2026-03-08T15:59:30.000Z';
    expect(isStaleHeartbeat({ lastHeartbeatAt, timeoutMs: 60_000, nowMs })).toBe(false);
  });
});

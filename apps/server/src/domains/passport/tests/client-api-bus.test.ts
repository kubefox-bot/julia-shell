import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchPassportStatusChanged,
  subscribePassportStatusChanged
} from '../client/bus';
import { fetchPassportStatus, retryPassportStatus } from '../client/api';

describe('passport client api', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetches status from passport endpoint', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      status: 'connected',
      label: 'Connected',
      updatedAt: '2026-03-09T10:00:00.000Z',
      reason: null,
      hostname: 'host',
      agentId: 'agent-a'
    }), { status: 200 })) as typeof fetch;

    const payload = await fetchPassportStatus();
    expect(payload.status).toBe('connected');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/passport/agent/status');
  });

  it('throws on failed retry status response', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      error: 'Unauthorized'
    }), { status: 401 })) as typeof fetch;

    await expect(retryPassportStatus()).rejects.toThrow('Unauthorized');
  });
});

describe('passport status bus', () => {
  beforeEach(() => {
    const eventTarget = new EventTarget();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: eventTarget
    });
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (globalThis as Record<string, unknown>).window;
  });

  it('dispatches and receives status change events', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePassportStatusChanged(listener);

    dispatchPassportStatusChanged({
      status: 'connected',
      updatedAt: '2026-03-09T10:00:00.000Z',
      reason: null
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      status: 'connected',
      updatedAt: '2026-03-09T10:00:00.000Z',
      reason: null
    });

    unsubscribe();
  });
});

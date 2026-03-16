import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchPassportStatusChanged,
  subscribePassportStatusChanged
} from '../client/bus';
import {
  connectPassportAgent,
  fetchPassportOnlineAgents,
  fetchPassportStatus,
  retryPassportStatus
} from '../client/api';

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
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const fetchMock = globalThis.fetch as unknown as {
      mock: { calls: Array<[RequestInfo | URL, RequestInit | undefined]> }
    };
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/passport/agent/status');
    expect(new Headers(init?.headers).get('x-request-id')).toBeTruthy();
  });

  it('throws on failed retry status response', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      error: 'Unauthorized'
    }), { status: 401 })) as typeof fetch;

    await expect(retryPassportStatus()).rejects.toThrow('Unauthorized');
  });

  it('fetches online agent list', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      agents: [
        {
          agentId: 'agent-a',
          displayName: 'Max',
          hostname: 'mac-local',
          connectedAt: '2026-03-09T10:00:00.000Z',
          lastHeartbeatAt: '2026-03-09T10:01:00.000Z',
          isCurrent: false
        }
      ]
    }), { status: 200 })) as typeof fetch;

    const payload = await fetchPassportOnlineAgents();
    expect(payload.agents[0]?.agentId).toBe('agent-a');
    const fetchMock = globalThis.fetch as unknown as {
      mock: { calls: Array<[RequestInfo | URL, RequestInit | undefined]> }
    };
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/passport/agent/status/list');
    expect(new Headers(init?.headers).get('x-request-id')).toBeTruthy();
  });

  it('posts selected agent to connect endpoint', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      status: 'connected',
      label: 'Connected',
      updatedAt: '2026-03-09T10:00:00.000Z',
      reason: null,
      hostname: 'host',
      agentId: 'agent-b'
    }), { status: 200 })) as typeof fetch;

    const payload = await connectPassportAgent('agent-b');
    expect(payload.agentId).toBe('agent-b');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/passport/agent/status/connect', expect.objectContaining({
      method: 'POST'
    }));
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

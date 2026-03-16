import { beforeEach, describe, expect, it, vi } from 'vitest';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const ACCESS_TOKEN_TTL_SECONDS = 3600;

const enrollPassportAgentMock = vi.hoisted(() => vi.fn());
const refreshPassportSessionMock = vi.hoisted(() => vi.fn());
const issuePassportBrowserAccessMock = vi.hoisted(() => vi.fn());
const resolvePassportRequestContextMock = vi.hoisted(() => vi.fn());
const getAgentStatusSnapshotMock = vi.hoisted(() => vi.fn());
const retryStatusSnapshotMock = vi.hoisted(() => vi.fn());
const getOnlineAgentSessionMock = vi.hoisted(() => vi.fn());
const getOnlineAgentSnapshotsMock = vi.hoisted(() => vi.fn());

vi.mock('../server/service', () => ({
  enrollPassportAgent: enrollPassportAgentMock,
  refreshPassportSession: refreshPassportSessionMock,
  issuePassportBrowserAccess: issuePassportBrowserAccessMock,
  revokePassportSession: vi.fn()
}));

vi.mock('../server/context', () => ({
  resolvePassportRequestContext: resolvePassportRequestContextMock
}));

vi.mock('../server/runtime/runtime', () => ({
  passportRuntime: {
    getAgentStatusSnapshot: getAgentStatusSnapshotMock,
    retryStatusSnapshot: retryStatusSnapshotMock,
    getOnlineAgentSession: getOnlineAgentSessionMock,
    getOnlineAgentSnapshots: getOnlineAgentSnapshotsMock
  }
}));

import { POST as enrollPost } from '../../../pages/api/passport/agent/enroll';
import { GET as statusGet } from '../../../pages/api/passport/agent/status';
import { POST as statusConnectPost } from '../../../pages/api/passport/agent/status/connect';
import { GET as statusListGet } from '../../../pages/api/passport/agent/status/list';
import { POST as statusRetryPost } from '../../../pages/api/passport/agent/status/retry';
import { POST as refreshPost } from '../../../pages/api/passport/agent/token/refresh';

describe('passport api routes', () => {
  beforeEach(() => {
    enrollPassportAgentMock.mockReset();
    refreshPassportSessionMock.mockReset();
    issuePassportBrowserAccessMock.mockReset();
    resolvePassportRequestContextMock.mockReset();
    getAgentStatusSnapshotMock.mockReset();
    retryStatusSnapshotMock.mockReset();
    getOnlineAgentSessionMock.mockReset();
    getOnlineAgentSnapshotsMock.mockReset();
  });

  it('validates enroll payload fields', async () => {
    const response = await enrollPost({
      request: new Request('http://localhost/api/passport/agent/enroll', {
        method: 'POST',
        body: JSON.stringify({ enrollment_token: 'token' }),
        headers: { 'Content-Type': 'application/json' }
      })
    } as never);

    expect(response.status).toBe(HTTP_STATUS_BAD_REQUEST);
  });

  it('returns tokens on enroll success', async () => {
    enrollPassportAgentMock.mockResolvedValue({
      agentId: 'agent-a',
      accessJwt: 'access-jwt',
      refreshToken: 'refresh-token',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS
    });

    const response = await enrollPost({
      request: new Request('http://localhost/api/passport/agent/enroll', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: 'agent-a',
          enrollment_token: 'token',
          device_info: 'mac',
          agent_version: '0.1.0'
        }),
        headers: { 'Content-Type': 'application/json' }
      })
    } as never);

    const payload = await response.json();
    expect(response.status).toBe(HTTP_STATUS_OK);
    expect(payload).toMatchObject({
      agent_id: 'agent-a',
      access_jwt: 'access-jwt',
      refresh_token: 'refresh-token',
      expires_in: ACCESS_TOKEN_TTL_SECONDS
    });
  });

  it('validates refresh payload fields', async () => {
    const response = await refreshPost({
      request: new Request('http://localhost/api/passport/agent/token/refresh', {
        method: 'POST',
        body: JSON.stringify({ agent_id: 'agent-a' }),
        headers: { 'Content-Type': 'application/json' }
      })
    } as never);

    expect(response.status).toBe(HTTP_STATUS_BAD_REQUEST);
  });

  it('returns 401 when refresh token is rejected', async () => {
    refreshPassportSessionMock.mockResolvedValue(null);

    const response = await refreshPost({
      request: new Request('http://localhost/api/passport/agent/token/refresh', {
        method: 'POST',
        body: JSON.stringify({ agent_id: 'agent-a', refresh_token: 'bad' }),
        headers: { 'Content-Type': 'application/json' }
      })
    } as never);

    expect(response.status).toBe(HTTP_STATUS_UNAUTHORIZED);
  });

  it('returns disconnected status when browser has no access token', async () => {
    getAgentStatusSnapshotMock.mockReturnValue({
      status: 'connected',
      label: 'Connected',
      updatedAt: '2026-03-09T10:00:00.000Z',
      reason: null,
      hostname: 'mac-local',
      agentId: 'agent-a'
    });
    resolvePassportRequestContextMock.mockResolvedValue({
      context: null,
      reason: 'missing'
    });

    const response = await statusGet({
      request: new Request('http://localhost/api/passport/agent/status')
    } as never);

    const payload = await response.json();
    expect(response.status).toBe(HTTP_STATUS_OK);
    expect(payload.status).toBe('disconnected');
    expect(payload.reason).toBe('No browser access token.');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('returns retry snapshot when browser has access token', async () => {
    retryStatusSnapshotMock.mockReturnValue({
      status: 'connected',
      label: 'Connected',
      updatedAt: '2026-03-09T10:00:00.000Z',
      reason: null,
      hostname: 'mac-local',
      agentId: 'agent-a'
    });
    resolvePassportRequestContextMock.mockResolvedValue({
      context: {
        agentId: 'agent-a',
        accessJwt: 'token',
        setCookieHeader: null
      },
      reason: 'missing'
    });

    const response = await statusRetryPost({
      request: new Request('http://localhost/api/passport/agent/status/retry', { method: 'POST' })
    } as never);

    expect(response.status).toBe(HTTP_STATUS_OK);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('returns unauthorized status when browser token is invalid', async () => {
    resolvePassportRequestContextMock.mockResolvedValue({
      context: null,
      reason: 'invalid'
    });

    const response = await statusGet({
      request: new Request('http://localhost/api/passport/agent/status')
    } as never);

    const payload = await response.json();
    expect(response.status).toBe(HTTP_STATUS_OK);
    expect(payload.status).toBe('unauthorized');
    expect(payload.reason).toBe('Invalid browser access token.');
  });

  it('lists online agents and marks current browser context', async () => {
    resolvePassportRequestContextMock.mockResolvedValue({
      context: {
        agentId: 'agent-b',
        accessJwt: 'token',
        setCookieHeader: null
      },
      reason: 'missing'
    });
    getOnlineAgentSnapshotsMock.mockReturnValue([
      {
        agentId: 'agent-b',
        sessionId: 'session-b',
        displayName: 'Yulia',
        hostname: 'yulia-win',
        connectedAt: '2026-03-09T10:00:00.000Z',
        lastHeartbeatAt: '2026-03-09T10:01:00.000Z',
        isCurrent: true
      }
    ]);

    const response = await statusListGet({
      request: new Request('http://localhost/api/passport/agent/status/list')
    } as never);

    const payload = await response.json();
    expect(response.status).toBe(HTTP_STATUS_OK);
    expect(payload.agents).toHaveLength(1);
    expect(payload.agents[0]).toMatchObject({
      agentId: 'agent-b',
      isCurrent: true
    });
  });

  it('connects browser to selected online agent', async () => {
    getOnlineAgentSessionMock.mockReturnValue({
      agentId: 'agent-b',
      sessionId: 'session-b',
      hostname: 'yulia-win',
      accessJwt: 'runtime-jwt'
    });
    issuePassportBrowserAccessMock.mockResolvedValue({
      agentId: 'agent-b',
      accessJwt: 'browser-jwt',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS
    });
    getAgentStatusSnapshotMock.mockReturnValue({
      status: 'connected',
      label: 'Connected',
      updatedAt: '2026-03-09T10:00:00.000Z',
      reason: null,
      hostname: 'yulia-win',
      agentId: 'agent-b'
    });

    const response = await statusConnectPost({
      request: new Request('http://localhost/api/passport/agent/status/connect', {
        method: 'POST',
        body: JSON.stringify({ agent_id: 'agent-b' }),
        headers: { 'Content-Type': 'application/json' }
      })
    } as never);

    const payload = await response.json();
    expect(response.status).toBe(HTTP_STATUS_OK);
    expect(payload.agentId).toBe('agent-b');
    expect(response.headers.get('set-cookie')).toContain('julia_access_token=browser-jwt');
  });

  it('rejects connect for offline or unknown agent', async () => {
    getOnlineAgentSessionMock.mockReturnValue(null);

    const response = await statusConnectPost({
      request: new Request('http://localhost/api/passport/agent/status/connect', {
        method: 'POST',
        body: JSON.stringify({ agent_id: 'agent-missing' }),
        headers: { 'Content-Type': 'application/json' }
      })
    } as never);

    expect(response.status).toBe(409);
  });
});

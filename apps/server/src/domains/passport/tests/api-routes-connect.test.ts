import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_OK
} from '@shared/lib/http-status'
import { PASSPORT_ACCESS_TTL_SECONDS } from '../server/config/consts'

const issuePassportBrowserAccessMock = vi.hoisted(() => vi.fn())
const getAgentStatusSnapshotMock = vi.hoisted(() => vi.fn())
const getOnlineAgentSessionMock = vi.hoisted(() => vi.fn())
const getOnlineAgentSnapshotsMock = vi.hoisted(() => vi.fn())
const resolvePassportRequestContextMock = vi.hoisted(() => vi.fn())

vi.mock('../server/service', () => ({
  enrollPassportAgent: vi.fn(),
  refreshPassportSession: vi.fn(),
  issuePassportBrowserAccess: issuePassportBrowserAccessMock,
  revokePassportSession: vi.fn(),
}))

vi.mock('../server/context', () => ({
  resolvePassportRequestContext: resolvePassportRequestContextMock,
}))

vi.mock('../server/runtime/runtime', () => ({
  passportRuntime: {
    getAgentStatusSnapshot: getAgentStatusSnapshotMock,
    retryStatusSnapshot: vi.fn(),
    getOnlineAgentSession: getOnlineAgentSessionMock,
    getOnlineAgentSnapshots: getOnlineAgentSnapshotsMock,
  },
}))

import { POST as statusConnectPost } from '../../../pages/api/passport/agent/status/connect'
import { GET as statusListGet } from '../../../pages/api/passport/agent/status/list'

describe('passport api routes connect', () => {
  beforeEach(() => {
    issuePassportBrowserAccessMock.mockReset()
    getAgentStatusSnapshotMock.mockReset()
    getOnlineAgentSessionMock.mockReset()
    getOnlineAgentSnapshotsMock.mockReset()
    resolvePassportRequestContextMock.mockReset()
  })


  it('lists online agents and marks current browser context', async () => {
    resolvePassportRequestContextMock.mockResolvedValue({
      context: {
        agentId: 'agent-b',
        accessJwt: 'token',
        setCookieHeader: null,
      },
      reason: 'missing',
    })
    getOnlineAgentSnapshotsMock.mockReturnValue([
      {
        agentId: 'agent-b',
        sessionId: 'session-b',
        displayName: 'Yulia',
        hostname: 'yulia-win',
        connectedAt: '2026-03-09T10:00:00.000Z',
        lastHeartbeatAt: '2026-03-09T10:01:00.000Z',
        isCurrent: true,
      },
    ])

    const response = await statusListGet({
      request: new Request('http://localhost/api/passport/agent/status/list'),
    } as never)

    const payload = await response.json()
    expect(response.status).toBe(HTTP_STATUS_OK)
    expect(payload.agents).toHaveLength(1)
    expect(payload.agents[0]).toMatchObject({ agentId: 'agent-b', isCurrent: true })
  })

  it('connects browser to selected online agent', async () => {
    getOnlineAgentSessionMock.mockReturnValue({
      agentId: 'agent-b',
      sessionId: 'session-b',
      hostname: 'yulia-win',
      accessJwt: 'runtime-jwt',
    })
    issuePassportBrowserAccessMock.mockResolvedValue({
      agentId: 'agent-b',
      accessJwt: 'browser-jwt',
      expiresIn: PASSPORT_ACCESS_TTL_SECONDS,
    })
    getAgentStatusSnapshotMock.mockReturnValue({
      status: 'connected',
      label: 'Connected',
      updatedAt: '2026-03-09T10:00:00.000Z',
      reason: null,
      hostname: 'yulia-win',
      agentId: 'agent-b',
    })

    const response = await statusConnectPost({
      request: new Request('http://localhost/api/passport/agent/status/connect', {
        method: 'POST',
        body: JSON.stringify({ agent_id: 'agent-b' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    } as never)

    const payload = await response.json()
    expect(response.status).toBe(HTTP_STATUS_OK)
    expect(payload.agentId).toBe('agent-b')
    expect(response.headers.get('set-cookie')).toContain('julia_access_token=browser-jwt')
  })

  it('rejects connect for offline or unknown agent', async () => {
    getOnlineAgentSessionMock.mockReturnValue(null)

    const response = await statusConnectPost({
      request: new Request('http://localhost/api/passport/agent/status/connect', {
        method: 'POST',
        body: JSON.stringify({ agent_id: 'agent-missing' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    } as never)

    expect(response.status).toBe(HTTP_STATUS_CONFLICT)
  })
})

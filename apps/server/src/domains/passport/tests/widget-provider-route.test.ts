import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolvePassportRequestContextMock = vi.hoisted(() => vi.fn())
const getOnlineAgentSessionMock = vi.hoisted(() => vi.fn())
const readRuntimeEnvMock = vi.hoisted(() => vi.fn())

vi.mock('../server/context', () => ({
  resolvePassportRequestContext: resolvePassportRequestContextMock
}))

vi.mock('../server/runtime/runtime', () => ({
  passportRuntime: {
    getOnlineAgentSession: getOnlineAgentSessionMock
  }
}))

vi.mock('@core/env', () => ({
  readRuntimeEnv: readRuntimeEnvMock
}))

import { GET as widgetProviderGet } from '../../../pages/api/passport/widget/provider'
import { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_OK } from '../../../shared/lib/http-status'

describe('passport widget provider route', () => {
  beforeEach(() => {
    resolvePassportRequestContextMock.mockReset()
    getOnlineAgentSessionMock.mockReset()
    readRuntimeEnvMock.mockReset()
    readRuntimeEnvMock.mockReturnValue({
      passportAgentDevModeEnabled: false
    })
  })

  it('validates required widget_id query', async () => {
    const response = await widgetProviderGet({
      request: new Request('http://localhost/api/passport/widget/provider')
    } as never)

    expect(response.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  it('returns requires_access_token for transcribe without browser token', async () => {
    resolvePassportRequestContextMock.mockResolvedValue({
      context: null,
      reason: 'missing'
    })
    getOnlineAgentSessionMock.mockReturnValue({ agentId: 'agent-a' })

    const response = await widgetProviderGet({
      request: new Request('http://localhost/api/passport/widget/provider?widget_id=com.yulia.transcribe')
    } as never)
    const payload = await response.json()

    expect(response.status).toBe(HTTP_STATUS_OK)
    expect(payload.status).toBe('requires_access_token')
    expect(payload.ready).toBe(false)
  })

  it('returns agent_offline for transcribe with token but no online agent', async () => {
    resolvePassportRequestContextMock.mockResolvedValue({
      context: {
        agentId: 'agent-a',
        accessJwt: 'jwt',
        setCookieHeader: null
      },
      reason: 'missing'
    })
    getOnlineAgentSessionMock.mockReturnValue(null)

    const response = await widgetProviderGet({
      request: new Request('http://localhost/api/passport/widget/provider?widget_id=com.yulia.transcribe')
    } as never)
    const payload = await response.json()

    expect(response.status).toBe(HTTP_STATUS_OK)
    expect(payload.status).toBe('agent_offline')
    expect(payload.ready).toBe(false)
  })

  it('returns requires_access_token for terminal-agent without browser token', async () => {
    resolvePassportRequestContextMock.mockResolvedValue({
      context: null,
      reason: 'missing'
    })
    getOnlineAgentSessionMock.mockReturnValue({ agentId: 'agent-a' })

    const response = await widgetProviderGet({
      request: new Request('http://localhost/api/passport/widget/provider?widget_id=com.yulia.terminal-agent')
    } as never)
    const payload = await response.json()

    expect(response.status).toBe(HTTP_STATUS_OK)
    expect(payload.status).toBe('requires_access_token')
    expect(payload.ready).toBe(false)
  })
})

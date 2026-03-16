import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WidgetRouteContext } from '../src/entities/widget/model/types'
import { passportRuntime } from '../src/domains/passport/server/runtime/runtime'
import { HTTP_STATUS_SERVICE_UNAVAILABLE } from '../src/shared/lib/http-status'
import { transcribeHandlers } from '../src/widgets/transcribe/server/handlers'
import { TRANSCRIBE_WIDGET_ID, buildWidgetApiRoute } from '../src/widgets'

function createContext(input: {
  action: string
  method?: string
  body?: Record<string, unknown>
}): WidgetRouteContext {
  const requestInit: RequestInit = {
    method: input.method ?? 'GET',
  }

  if (input.body) {
    requestInit.headers = { 'Content-Type': 'application/json' }
    requestInit.body = JSON.stringify(input.body)
  }

  return {
    request: new Request(`http://localhost${buildWidgetApiRoute(TRANSCRIBE_WIDGET_ID, input.action)}`, requestInit),
    agentId: 'agent-test',
    action: input.action,
    actionSegments: [input.action],
    params: {
      id: TRANSCRIBE_WIDGET_ID,
    },
  }
}

describe('transcribe server module', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns agent_offline for fs-list when agent session is unavailable', async () => {
    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue(null)

    const response = await transcribeHandlers['POST fs-list'](
      createContext({
        action: 'fs-list',
        method: 'POST',
        body: { path: '/Users/demo' },
      })
    )

    expect(response.status).toBe(HTTP_STATUS_SERVICE_UNAVAILABLE)
    await expect(response.json()).resolves.toEqual({ error: 'agent_offline' })
  })

  it('returns agent_offline for transcribe-stream when agent session is unavailable', async () => {
    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue(null)

    const response = await transcribeHandlers['POST transcribe-stream'](
      createContext({
        action: 'transcribe-stream',
        method: 'POST',
        body: {
          folderPath: '/Users/demo',
          filePaths: ['/Users/demo/clip-1.opus'],
        },
      })
    )

    expect(response.status).toBe(HTTP_STATUS_SERVICE_UNAVAILABLE)
    await expect(response.json()).resolves.toEqual({ error: 'agent_offline' })
  })
})

import { err, ok } from 'neverthrow'
import { describe, expect, it, vi } from 'vitest'
import { saveTerminalAgentSettings } from '../src/domains/llm/server/repository/terminal-agent-repository'
import * as llmCatalogService from '../src/domains/llm/server/service'
import { terminalAgentHandlers } from '../src/widgets/terminal-agent/server/handlers'
import { WIDGET_ID } from '../src/widgets/terminal-agent/server/constants'
import { createContext, HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_OK, HTTP_STATUS_SERVICE_UNAVAILABLE, setupTerminalAgentTestFs } from './terminal-agent-server.shared'

setupTerminalAgentTestFs()

describe('terminal-agent server handlers models', () => {
  it('returns provider-specific model list from llm catalog service', async () => {
    saveTerminalAgentSettings({ agentId: 'agent-a', widgetId: WIDGET_ID, activeProvider: 'codex', codexApiKey: 'codex-secret', geminiApiKey: 'gemini-secret', codexCommand: 'codex', codexArgs: [], codexModel: 'gpt-5-codex', geminiCommand: 'gemini', geminiArgs: ['--output-format', 'stream-json'], geminiModel: 'gemini-2.5-flash', useShellFallback: false, shellOverride: '' })
    const serviceSpy = vi.spyOn(llmCatalogService, 'getLlmModelCatalog').mockResolvedValue(ok({ provider: 'codex', models: ['gpt-5-codex', 'o3'], source: 'remote', updatedAt: '2026-03-09T10:00:00.000Z', stale: false }))

    const response = await terminalAgentHandlers['GET models'](createContext({ url: 'http://localhost/api/widget/com.yulia.terminal-agent/models?provider=codex', action: 'models', actionSegments: ['models'] }))
    expect(response.status).toBe(HTTP_STATUS_OK)
    expect(serviceSpy).toHaveBeenCalledWith({ provider: 'codex', apiKey: 'codex-secret', forceRefresh: false })

    const payload = await response.json() as Record<string, unknown>
    expect(payload.items).toEqual([{ value: 'gpt-5-codex', label: 'gpt-5-codex' }, { value: 'o3', label: 'o3' }])
  })

  it('validates models query and maps llm service error', async () => {
    const badRequest = await terminalAgentHandlers['GET models'](createContext({ url: 'http://localhost/api/widget/com.yulia.terminal-agent/models?provider=unknown', action: 'models', actionSegments: ['models'] }))
    expect(badRequest.status).toBe(HTTP_STATUS_BAD_REQUEST)

    vi.spyOn(llmCatalogService, 'getLlmModelCatalog').mockResolvedValue(err({ code: 'provider_http_error', message: 'upstream failed', retryable: true }))
    const upstreamFailed = await terminalAgentHandlers['GET models'](createContext({ url: 'http://localhost/api/widget/com.yulia.terminal-agent/models?provider=gemini&refresh=1', action: 'models', actionSegments: ['models'] }))
    expect(upstreamFailed.status).toBe(HTTP_STATUS_SERVICE_UNAVAILABLE)
    expect(await upstreamFailed.json()).toEqual({ error: 'upstream failed', code: 'provider_http_error' })
  })
})

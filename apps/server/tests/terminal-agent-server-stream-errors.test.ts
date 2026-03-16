import { describe, expect, it, vi } from 'vitest'
import { getTerminalAgentDialogState, saveTerminalAgentSettings } from '../src/domains/llm/server/repository/terminal-agent-repository'
import { passportRuntime } from '../src/domains/passport/server/runtime/runtime'
import { moduleBus } from '../src/shared/lib/module-bus'
import { terminalAgentHandlers } from '../src/widgets/terminal-agent/server/handlers'
import { WIDGET_ID } from '../src/widgets/terminal-agent/server/constants'
import { buildWidgetApiRoute } from '../src/widgets'
import { collectSseEventsWithTimeout, createContext, createOnlineAgentSession, HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_OK, HTTP_STATUS_SERVICE_UNAVAILABLE, setupTerminalAgentTestFs } from './terminal-agent-server.shared'

setupTerminalAgentTestFs()

describe('terminal-agent server handlers stream errors', () => {
  it('uses current bound agent settings even when another agent could be online', async () => {
    saveTerminalAgentSettings({ agentId: 'agent-a', widgetId: WIDGET_ID, activeProvider: 'gemini', codexApiKey: '', geminiApiKey: '', codexCommand: 'codex', codexArgs: [], codexModel: 'gpt-5-codex', geminiCommand: 'gemini', geminiArgs: ['--output-format', 'stream-json'], geminiModel: 'gemini-2.5-flash', useShellFallback: false, shellOverride: '' })
    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue(createOnlineAgentSession('agent-a'))
    const dispatchSpy = vi.spyOn(passportRuntime, 'dispatchTerminalAgentSendMessage').mockReturnValue(true)

    const response = await terminalAgentHandlers['POST message-stream'](createContext({
      url: `http://localhost${buildWidgetApiRoute(WIDGET_ID, 'message-stream')}`,
      method: 'POST',
      action: 'message-stream',
      body: { provider: 'gemini', message: 'Hello' },
      agentId: 'agent-a'
    }))
    expect(response.status).toBe(HTTP_STATUS_OK)
    await vi.waitFor(() => expect(dispatchSpy).toHaveBeenCalledTimes(1))

    const dispatchedInput = dispatchSpy.mock.calls[0]?.[0] as { apiKey?: string; commandPath?: string } | undefined
    expect(dispatchedInput?.apiKey).toBe('')
    expect(dispatchedInput?.commandPath).toBe('gemini')
  })

  it('maps gemini missing api key noise to single domain-level message', async () => {
    saveTerminalAgentSettings({ agentId: 'agent-a', widgetId: WIDGET_ID, activeProvider: 'gemini', codexApiKey: '', geminiApiKey: '', codexCommand: 'codex', codexArgs: [], codexModel: 'gpt-5-codex', geminiCommand: 'gemini', geminiArgs: ['--output-format', 'stream-json'], geminiModel: 'gemini-2.5-flash', useShellFallback: false, shellOverride: '' })
    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue(createOnlineAgentSession())
    const dispatchSpy = vi.spyOn(passportRuntime, 'dispatchTerminalAgentSendMessage').mockReturnValue(true)

    const response = await terminalAgentHandlers['POST message-stream'](createContext({
      url: `http://localhost${buildWidgetApiRoute(WIDGET_ID, 'message-stream')}`,
      method: 'POST',
      action: 'message-stream',
      body: { provider: 'gemini', message: 'Ping missing key mapping' }
    }))
    expect(response.status).toBe(HTTP_STATUS_OK)
    await vi.waitFor(() => expect(dispatchSpy).toHaveBeenCalledTimes(1))

    const dialogId = String((dispatchSpy.mock.calls[0]?.[0] as { dialogId?: string } | undefined)?.dialogId ?? '')
    const streamEventsPromise = collectSseEventsWithTimeout(response)
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', { type: 'status', payload: { status: 'tool_call', detail: 'When using Gemini API, you must specify the GEMINI_API_KEY environment variable.' } })
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', { type: 'status', payload: { status: 'tool_call', detail: 'Update your environment and try again (no reload needed if using .env)!' } })
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', { type: 'error', payload: { message: 'Provider exited with code: 41' } })

    const events = await streamEventsPromise
    expect(events.map((item) => item.event)).toEqual(['status', 'status', 'error'])
    expect(events[1]?.payload).toEqual({ status: 'tool_call', detail: 'Gemini API key is missing. Set GEMINI_API_KEY and retry later.' })
    expect(events[2]?.payload).toEqual({ message: 'Gemini API key is missing. Set GEMINI_API_KEY and retry later.' })
  })

  it('returns validation/offline errors for message stream entry point', async () => {
    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue(null)

    const offlineResponse = await terminalAgentHandlers['POST message-stream'](createContext({
      url: `http://localhost${buildWidgetApiRoute(WIDGET_ID, 'message-stream')}`,
      method: 'POST',
      action: 'message-stream',
      body: { provider: 'codex', message: 'Hello' }
    }))
    expect(offlineResponse.status).toBe(HTTP_STATUS_SERVICE_UNAVAILABLE)
    expect(await offlineResponse.json()).toEqual({ error: 'agent_offline' })

    const validationResponse = await terminalAgentHandlers['POST message-stream'](createContext({
      url: `http://localhost${buildWidgetApiRoute(WIDGET_ID, 'message-stream')}`,
      method: 'POST',
      action: 'message-stream',
      body: { provider: 'codex', message: '   ' }
    }))
    expect(validationResponse.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(await validationResponse.json()).toEqual({ error: 'message is required.' })
  })

  it('handles dispatch failure by emitting agent_offline SSE and marking state as error', async () => {
    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue(createOnlineAgentSession())
    vi.spyOn(passportRuntime, 'dispatchTerminalAgentSendMessage').mockReturnValue(false)

    const response = await terminalAgentHandlers['POST message-stream'](createContext({
      url: `http://localhost${buildWidgetApiRoute(WIDGET_ID, 'message-stream')}`,
      method: 'POST',
      action: 'message-stream',
      body: { provider: 'codex', message: 'Hello' }
    }))
    expect(response.status).toBe(HTTP_STATUS_OK)

    const events = await collectSseEventsWithTimeout(response)
    expect(events.map((item) => item.event)).toEqual(['status', 'error'])
    expect(events[1]?.payload).toEqual({ message: 'agent_offline' })

    const state = getTerminalAgentDialogState('agent-a', WIDGET_ID, 'codex')
    expect(state.status).toBe('error')
    expect(state.lastError).toBe('agent_offline')
  })
})

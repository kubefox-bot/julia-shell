import { describe, expect, it, vi } from 'vitest'
import { getTerminalAgentDialogState, saveTerminalAgentSettings, upsertTerminalAgentDialogState } from '../src/domains/llm/server/repository/terminal-agent-repository'
import { passportRuntime } from '../src/domains/passport/server/runtime/runtime'
import { moduleBus } from '../src/shared/lib/module-bus'
import { terminalAgentHandlers } from '../src/widgets/terminal-agent/server/handlers'
import { WIDGET_ID } from '../src/widgets/terminal-agent/server/constants'
import { buildWidgetApiRoute } from '../src/widgets'
import { collectSseEventsWithTimeout, createContext, createOnlineAgentSession, HTTP_STATUS_OK, setupTerminalAgentTestFs } from './terminal-agent-server.shared'

setupTerminalAgentTestFs()

describe('terminal-agent server handlers stream primary', () => {
  it('streams status/chunks/done and persists continuity ref', async () => {
    saveTerminalAgentSettings({ agentId: 'agent-a', widgetId: WIDGET_ID, activeProvider: 'codex', codexApiKey: 'codex-key', geminiApiKey: '', codexCommand: '/usr/local/bin/codex', codexArgs: ['--flag'], codexModel: 'gpt-5-codex', geminiCommand: 'gemini', geminiArgs: ['--output-format', 'stream-json'], geminiModel: 'gemini-2.5-flash', useShellFallback: false, shellOverride: '' })
    upsertTerminalAgentDialogState({ agentId: 'agent-a', widgetId: WIDGET_ID, provider: 'codex', providerSessionRef: 'resume-ref', status: 'done', lastError: null })
    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue(createOnlineAgentSession())
    const dispatchSpy = vi.spyOn(passportRuntime, 'dispatchTerminalAgentSendMessage').mockReturnValue(true)

    const response = await terminalAgentHandlers['POST message-stream'](createContext({
      url: `http://localhost${buildWidgetApiRoute(WIDGET_ID, 'message-stream')}`,
      method: 'POST',
      action: 'message-stream',
      body: { provider: 'codex', message: 'Hello' }
    }))
    expect(response.status).toBe(HTTP_STATUS_OK)
    await vi.waitFor(() => expect(dispatchSpy).toHaveBeenCalledTimes(1))

    const dispatchedInput = dispatchSpy.mock.calls[0]?.[0] as { resumeRef?: string; commandPath?: string; commandArgs?: string[]; dialogId?: string } | undefined
    expect(dispatchedInput?.resumeRef).toBe('resume-ref')
    expect(dispatchedInput?.commandPath).toBe('/usr/local/bin/codex')
    expect(dispatchedInput?.commandArgs).toEqual(['--flag', '--model', 'gpt-5-codex'])

    const dialogId = String(dispatchedInput?.dialogId ?? '')
    const streamEventsPromise = collectSseEventsWithTimeout(response)
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', { type: 'status', payload: { status: 'thinking', detail: 'thinking...' } })
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', { type: 'assistant_chunk', payload: { text: 'Hi from assistant.' } })
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', { type: 'assistant_done', payload: { providerRef: 'session-new', finishReason: 'completed' } })

    const events = await streamEventsPromise
    expect(events.map((item) => item.event)).toEqual(['status', 'status', 'status', 'assistant_chunk', 'assistant_done'])
    const state = getTerminalAgentDialogState('agent-a', WIDGET_ID, 'codex')
    expect(state.providerSessionRef).toBe('session-new')
    expect(state.status).toBe('done')
    expect(state.lastError).toBeNull()
  })

  it('marks resume_failed flow and closes on error', async () => {
    saveTerminalAgentSettings({ agentId: 'agent-a', widgetId: WIDGET_ID, activeProvider: 'gemini', codexApiKey: '', geminiApiKey: 'gemini-key', codexCommand: 'codex', codexArgs: [], codexModel: 'gpt-5-codex', geminiCommand: 'gemini', geminiArgs: ['--output-format', 'stream-json'], geminiModel: 'gemini-2.5-flash', useShellFallback: true, shellOverride: 'pwsh' })
    upsertTerminalAgentDialogState({ agentId: 'agent-a', widgetId: WIDGET_ID, provider: 'gemini', providerSessionRef: 'resume-gemini', status: 'done', lastError: null })
    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue(createOnlineAgentSession())
    const dispatchSpy = vi.spyOn(passportRuntime, 'dispatchTerminalAgentSendMessage').mockReturnValue(true)

    const response = await terminalAgentHandlers['POST message-stream'](createContext({
      url: `http://localhost${buildWidgetApiRoute(WIDGET_ID, 'message-stream')}`,
      method: 'POST',
      action: 'message-stream',
      body: { provider: 'gemini', message: 'Resume this' }
    }))
    expect(response.status).toBe(HTTP_STATUS_OK)
    await vi.waitFor(() => expect(dispatchSpy).toHaveBeenCalledTimes(1))

    const dialogId = String((dispatchSpy.mock.calls[0]?.[0] as { dialogId?: string } | undefined)?.dialogId ?? '')
    const streamEventsPromise = collectSseEventsWithTimeout(response)
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', { type: 'resume_failed', payload: { reason: 'resume_failed' } })
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', { type: 'error', payload: { message: 'provider_exit_error' } })

    const events = await streamEventsPromise
    expect(events.map((item) => item.event)).toEqual(['status', 'status', 'resume_failed', 'error'])
    const state = getTerminalAgentDialogState('agent-a', WIDGET_ID, 'gemini')
    expect(state.providerSessionRef).toBe('')
    expect(state.status).toBe('error')
    expect(state.lastError).toBe('provider_exit_error')
  })

  it('maps gemini quota noise to single domain-level message', async () => {
    saveTerminalAgentSettings({ agentId: 'agent-a', widgetId: WIDGET_ID, activeProvider: 'gemini', codexApiKey: '', geminiApiKey: 'gemini-key', codexCommand: 'codex', codexArgs: [], codexModel: 'gpt-5-codex', geminiCommand: 'gemini', geminiArgs: ['--output-format', 'stream-json'], geminiModel: 'gemini-2.5-flash', useShellFallback: false, shellOverride: '' })
    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue(createOnlineAgentSession())
    const dispatchSpy = vi.spyOn(passportRuntime, 'dispatchTerminalAgentSendMessage').mockReturnValue(true)

    const response = await terminalAgentHandlers['POST message-stream'](createContext({
      url: `http://localhost${buildWidgetApiRoute(WIDGET_ID, 'message-stream')}`,
      method: 'POST',
      action: 'message-stream',
      body: { provider: 'gemini', message: 'Ping quota mapping' }
    }))
    expect(response.status).toBe(HTTP_STATUS_OK)
    await vi.waitFor(() => expect(dispatchSpy).toHaveBeenCalledTimes(1))

    const dialogId = String((dispatchSpy.mock.calls[0]?.[0] as { dialogId?: string } | undefined)?.dialogId ?? '')
    const streamEventsPromise = collectSseEventsWithTimeout(response)
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', { type: 'status', payload: { status: 'tool_call', detail: 'at classifyGoogleError (file:///path/googleQuotaErrors.js:206:24)' } })
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', { type: 'status', payload: { status: 'tool_call', detail: 'TerminalQuotaError: You have exhausted your daily quota on this model.' } })
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', { type: 'error', payload: { message: 'Provider exited with code: 1' } })

    const events = await streamEventsPromise
    expect(events.map((item) => item.event)).toEqual(['status', 'status', 'error'])
    expect(events[1]?.payload).toEqual({ status: 'tool_call', detail: 'Gemini quota exceeded. Check billing/limits and retry later.' })
    expect(events[2]?.payload).toEqual({ message: 'Gemini quota exceeded. Check billing/limits and retry later.' })
  })
})

import { describe, expect, it, vi } from 'vitest'
import { getTerminalAgentDialogState, upsertTerminalAgentDialogState } from '../src/domains/llm/server/repository/terminal-agent-repository'
import { passportRuntime } from '../src/domains/passport/server/runtime/runtime'
import { terminalAgentHandlers } from '../src/widgets/terminal-agent/server/handlers'
import { WIDGET_ID } from '../src/widgets/terminal-agent/server/constants'
import { terminalAgentServerModule } from '../src/widgets/terminal-agent/server/module'
import { createContext, createOnlineAgentSession, HTTP_STATUS_OK, setupTerminalAgentTestFs } from './terminal-agent-server.shared'

setupTerminalAgentTestFs()

describe('terminal-agent server handlers settings', () => {
  it('handles settings endpoints and resets continuity on provider switch', async () => {
    upsertTerminalAgentDialogState({ agentId: 'agent-a', widgetId: WIDGET_ID, provider: 'codex', providerSessionRef: 'codex-ref', status: 'done', lastError: null })
    upsertTerminalAgentDialogState({ agentId: 'agent-a', widgetId: WIDGET_ID, provider: 'gemini', providerSessionRef: 'gemini-ref', status: 'done', lastError: null })

    const getResponse = await terminalAgentHandlers['GET settings'](createContext({ url: 'http://localhost/api/widget/com.yulia.terminal-agent/settings', action: 'settings' }))
    expect(getResponse.status).toBe(HTTP_STATUS_OK)
    const initialSettings = await getResponse.json() as Record<string, unknown>
    expect(initialSettings.activeProvider).toBe('codex')

    const postResponse = await terminalAgentHandlers['POST settings'](createContext({
      url: 'http://localhost/api/widget/com.yulia.terminal-agent/settings',
      method: 'POST',
      action: 'settings',
      body: {
        activeProvider: 'gemini',
        codexCommand: 'codex',
        codexArgs: ['--json'],
        geminiCommand: 'gemini',
        geminiArgs: ['--output-format', 'stream-json'],
        useShellFallback: true,
        shellOverride: 'pwsh',
      },
    }))

    expect(postResponse.status).toBe(HTTP_STATUS_OK)
    const savedSettings = await postResponse.json() as Record<string, unknown>
    expect(savedSettings.activeProvider).toBe('gemini')
    expect(savedSettings.useShellFallback).toBe(true)
    expect(getTerminalAgentDialogState('agent-a', WIDGET_ID, 'codex').providerSessionRef).toBe('')
    expect(getTerminalAgentDialogState('agent-a', WIDGET_ID, 'gemini').providerSessionRef).toBe('')
  })

  it('reports module readiness based on runtime online session', async () => {
    await expect(terminalAgentServerModule.init?.()).resolves.toEqual({ ready: true })
  })

  it('handles dialog reset and dispatches reset command to runtime', async () => {
    upsertTerminalAgentDialogState({ agentId: 'agent-a', widgetId: WIDGET_ID, provider: 'codex', providerSessionRef: 'resume-codex', status: 'done', lastError: null })
    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue(createOnlineAgentSession())
    const resetSpy = vi.spyOn(passportRuntime, 'dispatchTerminalAgentResetDialog').mockReturnValue(true)

    const response = await terminalAgentHandlers['POST dialog/new'](createContext({
      url: 'http://localhost/api/widget/com.yulia.terminal-agent/dialog/new',
      method: 'POST',
      action: 'dialog/new',
      actionSegments: ['dialog', 'new'],
      body: { provider: 'codex' },
    }))

    expect(response.status).toBe(HTTP_STATUS_OK)
    expect(resetSpy).toHaveBeenCalledWith({
      agentId: 'runtime-agent',
      sessionId: 'runtime-session',
      dialogId: `${WIDGET_ID}:codex`,
      reason: 'new_dialog',
    })
    expect(getTerminalAgentDialogState('agent-a', WIDGET_ID, 'codex').providerSessionRef).toBe('')
  })
})

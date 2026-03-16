import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearTerminalAgentDialogState,
  getTerminalAgentDialogState,
  getTerminalAgentSettings,
  saveTerminalAgentSettings,
  upsertTerminalAgentDialogState,
} from '../src/domains/llm/server/repository/terminal-agent-repository'
import { updateTerminalAgentSettings } from '../src/widgets/terminal-agent/server/settings'
import { resetDbCache } from '../src/core/db/shared'
import { TERMINAL_AGENT_WIDGET_ID } from '../src/widgets'

let tempDir = ''

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-terminal-agent-db-'))
  process.env.JULIAAPP_DATA_DIR = tempDir
})

afterEach(() => {
  resetDbCache()
  fs.rmSync(tempDir, { recursive: true, force: true })
  delete process.env.JULIAAPP_DATA_DIR
})

describe('terminal-agent repository', () => {
  it('stores settings and continuity refs per provider', () => {
    const agentId = 'agent-a'

    saveTerminalAgentSettings({
      agentId,
      widgetId: TERMINAL_AGENT_WIDGET_ID,
      activeProvider: 'gemini',
      codexApiKey: 'codex-key',
      geminiApiKey: 'gemini-key',
      codexCommand: 'codex',
      codexArgs: ['exec', '--json'],
      codexModel: 'gpt-5-codex',
      geminiCommand: 'gemini',
      geminiArgs: ['--output-format', 'stream-json'],
      geminiModel: 'gemini-2.5-flash',
      useShellFallback: true,
      shellOverride: 'pwsh',
    })

    upsertTerminalAgentDialogState({
      agentId,
      widgetId: TERMINAL_AGENT_WIDGET_ID,
      provider: 'gemini',
      providerSessionRef: 'gem-tag-1',
      status: 'done',
      lastError: null,
    })

    upsertTerminalAgentDialogState({
      agentId,
      widgetId: TERMINAL_AGENT_WIDGET_ID,
      provider: 'codex',
      providerSessionRef: 'codex-session-1',
      status: 'done',
      lastError: null,
    })

    const settings = getTerminalAgentSettings(agentId, TERMINAL_AGENT_WIDGET_ID)
    expect(settings.activeProvider).toBe('gemini')
    expect(settings.useShellFallback).toBe(true)
    expect(settings.shellOverride).toBe('pwsh')

    const geminiState = getTerminalAgentDialogState(agentId, TERMINAL_AGENT_WIDGET_ID, 'gemini')
    const codexState = getTerminalAgentDialogState(agentId, TERMINAL_AGENT_WIDGET_ID, 'codex')

    expect(geminiState.providerSessionRef).toBe('gem-tag-1')
    expect(codexState.providerSessionRef).toBe('codex-session-1')

    clearTerminalAgentDialogState(agentId, TERMINAL_AGENT_WIDGET_ID, 'gemini')
    expect(getTerminalAgentDialogState(agentId, TERMINAL_AGENT_WIDGET_ID, 'gemini').providerSessionRef).toBe('')
  })

  it('resets continuity state when active provider changes', () => {
    const agentId = 'agent-b'

    upsertTerminalAgentDialogState({
      agentId,
      widgetId: TERMINAL_AGENT_WIDGET_ID,
      provider: 'gemini',
      providerSessionRef: 'gem-resume',
      status: 'done',
      lastError: null,
    })
    upsertTerminalAgentDialogState({
      agentId,
      widgetId: TERMINAL_AGENT_WIDGET_ID,
      provider: 'codex',
      providerSessionRef: 'codex-resume',
      status: 'done',
      lastError: null,
    })

    updateTerminalAgentSettings(agentId, { activeProvider: 'gemini' })

    expect(getTerminalAgentDialogState(agentId, TERMINAL_AGENT_WIDGET_ID, 'gemini').providerSessionRef).toBe('')
    expect(getTerminalAgentDialogState(agentId, TERMINAL_AGENT_WIDGET_ID, 'gemini').status).toBe('idle')
    expect(getTerminalAgentDialogState(agentId, TERMINAL_AGENT_WIDGET_ID, 'codex').providerSessionRef).toBe('')
    expect(getTerminalAgentDialogState(agentId, TERMINAL_AGENT_WIDGET_ID, 'codex').status).toBe('idle')
  })
})

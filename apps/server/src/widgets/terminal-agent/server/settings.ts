import {
  getTerminalAgentDialogState,
  getTerminalAgentSettings,
  saveTerminalAgentSettings,
  type TerminalAgentProvider,
  clearTerminalAgentDialogState,
  upsertTerminalAgentDialogState,
} from '../../../core/db/terminal-agent-repository'
import { PROVIDERS, WIDGET_ID } from './constants'
import type { TerminalAgentDialogStatePayload, TerminalAgentSettingsPayload } from './types'

export function buildTerminalAgentSettingsPayload(agentId: string): TerminalAgentSettingsPayload {
  const settings = getTerminalAgentSettings(agentId, WIDGET_ID)

  return {
    widgetId: WIDGET_ID,
    activeProvider: settings.activeProvider,
    providers: [...PROVIDERS],
    codexApiKey: settings.codexApiKey,
    geminiApiKey: settings.geminiApiKey,
    codexCommand: settings.codexCommand,
    codexArgs: settings.codexArgs,
    geminiCommand: settings.geminiCommand,
    geminiArgs: settings.geminiArgs,
    useShellFallback: settings.useShellFallback,
    shellOverride: settings.shellOverride,
  }
}

export function updateTerminalAgentSettings(agentId: string, input: {
  activeProvider?: TerminalAgentProvider
  codexApiKey?: string
  geminiApiKey?: string
  codexCommand?: string
  codexArgs?: string[]
  geminiCommand?: string
  geminiArgs?: string[]
  useShellFallback?: boolean
  shellOverride?: string
}) {
  const current = getTerminalAgentSettings(agentId, WIDGET_ID)
  const nextProvider = input.activeProvider ?? current.activeProvider

  saveTerminalAgentSettings({
    agentId,
    widgetId: WIDGET_ID,
    activeProvider: nextProvider,
    codexApiKey: typeof input.codexApiKey === 'string' ? input.codexApiKey : current.codexApiKey,
    geminiApiKey: typeof input.geminiApiKey === 'string' ? input.geminiApiKey : current.geminiApiKey,
    codexCommand: typeof input.codexCommand === 'string' ? input.codexCommand : current.codexCommand,
    codexArgs: Array.isArray(input.codexArgs) ? input.codexArgs : current.codexArgs,
    geminiCommand: typeof input.geminiCommand === 'string' ? input.geminiCommand : current.geminiCommand,
    geminiArgs: Array.isArray(input.geminiArgs) ? input.geminiArgs : current.geminiArgs,
    useShellFallback: typeof input.useShellFallback === 'boolean' ? input.useShellFallback : current.useShellFallback,
    shellOverride: typeof input.shellOverride === 'string' ? input.shellOverride : current.shellOverride,
  })

  if (nextProvider !== current.activeProvider) {
    clearTerminalAgentDialogState(agentId, WIDGET_ID, 'codex')
    clearTerminalAgentDialogState(agentId, WIDGET_ID, 'gemini')
  }

  return buildTerminalAgentSettingsPayload(agentId)
}

export function getTerminalAgentDialogStatePayload(agentId: string, provider: TerminalAgentProvider): TerminalAgentDialogStatePayload {
  const state = getTerminalAgentDialogState(agentId, WIDGET_ID, provider)

  return {
    widgetId: WIDGET_ID,
    provider,
    providerSessionRef: state.providerSessionRef,
    status: state.status,
    lastError: state.lastError,
  }
}

export function resetTerminalAgentDialog(agentId: string, provider: TerminalAgentProvider) {
  clearTerminalAgentDialogState(agentId, WIDGET_ID, provider)
  return getTerminalAgentDialogStatePayload(agentId, provider)
}

export function markDialogStatus(input: {
  agentId: string
  provider: TerminalAgentProvider
  providerSessionRef?: string
  status: string
  lastError?: string | null
}) {
  upsertTerminalAgentDialogState({
    agentId: input.agentId,
    widgetId: WIDGET_ID,
    provider: input.provider,
    providerSessionRef: input.providerSessionRef,
    status: input.status,
    lastError: input.lastError,
  })
}

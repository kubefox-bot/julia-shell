import {
  getTerminalAgentDialogState,
  getTerminalAgentSettings,
  listTerminalAgentDialogRefs,
  saveTerminalAgentSettings,
  type TerminalAgentProvider,
  clearTerminalAgentDialogState,
  upsertTerminalAgentDialogState,
  upsertTerminalAgentDialogRef,
} from '../../../domains/llm/server/repository/terminal-agent-repository'
import { PROVIDERS, WIDGET_ID } from './constants'
import type { TerminalAgentDialogRefItemPayload, TerminalAgentDialogStatePayload, TerminalAgentSettingsPayload } from './types'

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
    codexModel: settings.codexModel,
    geminiCommand: settings.geminiCommand,
    geminiArgs: settings.geminiArgs,
    geminiModel: settings.geminiModel,
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
  codexModel?: string
  geminiCommand?: string
  geminiArgs?: string[]
  geminiModel?: string
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
    codexModel: typeof input.codexModel === 'string' ? input.codexModel : current.codexModel,
    geminiCommand: typeof input.geminiCommand === 'string' ? input.geminiCommand : current.geminiCommand,
    geminiArgs: Array.isArray(input.geminiArgs) ? input.geminiArgs : current.geminiArgs,
    geminiModel: typeof input.geminiModel === 'string' ? input.geminiModel : current.geminiModel,
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

  if (input.providerSessionRef) {
    upsertTerminalAgentDialogRef({
      agentId: input.agentId,
      widgetId: WIDGET_ID,
      provider: input.provider,
      providerSessionRef: input.providerSessionRef,
      lastStatus: input.status,
    })
  }
}

export function listTerminalAgentDialogsPayload(agentId: string, provider: TerminalAgentProvider): TerminalAgentDialogRefItemPayload[] {
  return listTerminalAgentDialogRefs(agentId, WIDGET_ID, provider).map((row) => ({
    providerSessionRef: row.providerSessionRef,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastStatus: row.lastStatus,
  }))
}

export function selectTerminalAgentDialog(
  agentId: string,
  provider: TerminalAgentProvider,
  providerSessionRef: string
) {
  upsertTerminalAgentDialogState({
    agentId,
    widgetId: WIDGET_ID,
    provider,
    providerSessionRef,
    status: 'resuming',
    lastError: null,
  })

  return getTerminalAgentDialogStatePayload(agentId, provider)
}

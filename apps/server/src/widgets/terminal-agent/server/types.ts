import type { TerminalAgentProvider } from '../../../domains/llm/server/repository/terminal-agent-repository'

export type TerminalAgentSettingsPayload = {
  widgetId: string
  activeProvider: TerminalAgentProvider
  providers: Array<{ value: TerminalAgentProvider; label: string }>
  codexApiKey: string
  geminiApiKey: string
  codexCommand: string
  codexArgs: string[]
  codexModel: string
  geminiCommand: string
  geminiArgs: string[]
  geminiModel: string
  useShellFallback: boolean
  shellOverride: string
}

export type TerminalAgentDialogStatePayload = {
  widgetId: string
  provider: TerminalAgentProvider
  providerSessionRef: string
  dialogTitle: string
  status: string
  lastError: string | null
}

export type TerminalAgentDialogRefItemPayload = {
  providerSessionRef: string
  dialogTitle: string
  createdAt: string
  updatedAt: string
  lastStatus: string
}

export type TerminalAgentLlmModelItemPayload = {
  value: string
  label: string
}

export type TerminalAgentLlmModelsPayload = {
  widgetId: string
  provider: TerminalAgentProvider
  source: 'db' | 'remote'
  stale: boolean
  updatedAt: string | null
  items: TerminalAgentLlmModelItemPayload[]
}

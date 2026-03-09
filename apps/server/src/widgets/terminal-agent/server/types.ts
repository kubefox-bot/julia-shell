import type { TerminalAgentProvider } from '../../../core/db/terminal-agent-repository'

export type TerminalAgentSettingsPayload = {
  widgetId: string
  activeProvider: TerminalAgentProvider
  providers: Array<{ value: TerminalAgentProvider; label: string }>
  codexApiKey: string
  geminiApiKey: string
  codexCommand: string
  codexArgs: string[]
  geminiCommand: string
  geminiArgs: string[]
  useShellFallback: boolean
  shellOverride: string
}

export type TerminalAgentDialogStatePayload = {
  widgetId: string
  provider: TerminalAgentProvider
  providerSessionRef: string
  status: string
  lastError: string | null
}

export type Provider = 'codex' | 'gemini'

export type SettingsPayload = {
  widgetId: string
  activeProvider: Provider
  providers: Array<{ value: Provider; label: string }>
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

export type DialogStatePayload = {
  provider: Provider
  providerSessionRef: string
  dialogTitle: string
  status: string
  lastError: string | null
}

export type MessageItem = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export type DialogRefItem = {
  providerSessionRef: string
  dialogTitle: string
  createdAt: string
  updatedAt: string
  lastStatus: string
}

export type ModelListPayload = {
  items?: Array<{ value: string; label: string }>
  error?: string
}

export type ParsedSseChunk = {
  eventName: string
  payload: Record<string, unknown>
}

export type RetryState = {
  message: string
  userMessageId: string
}

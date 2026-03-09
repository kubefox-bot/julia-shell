export type BusPayload = {
  type?: string
  payload?: Record<string, unknown>
}

export type ProviderSettingsShape = {
  codexApiKey: string
  geminiApiKey: string
  codexCommand: string
  geminiCommand: string
  codexArgs: string[]
  geminiArgs: string[]
  codexModel: string
  geminiModel: string
  useShellFallback: boolean
  shellOverride: string
}

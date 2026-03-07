export type SsePayload = Record<string, unknown>

export type UploadedGeminiFile = {
  name?: string | null
  uri?: string | null
  mimeType?: string | null
}

export type ResolvedSelection = {
  filePaths: string[]
  canonicalSourceFile: string
  resolvedFolderPath: string
}

export type BrowserEntry = {
  name: string
  path: string
  type: 'dir' | 'file'
}

export type SecretState =
  | {
      source: 'infisical'
      value: string
      displayValue: string
      editable: false
      secretPath: string | null
    }
  | {
      source: 'db' | 'env'
      value: string
      displayValue: string
      editable: true
      secretPath: null
    }
  | {
      source: 'missing'
      value: ''
      displayValue: ''
      editable: true
      secretPath: null
    }

export type TranscribeSettingsPayload = {
  widgetId: string
  envName: string
  geminiModel: string
  availableModels: string[]
  apiKeySource: 'infisical' | 'db' | 'env' | 'missing'
  apiKeyEditable: boolean
  apiKeyValue: string
  hasApiKey: boolean
  secretName: string
  secretPath: string | null
  recentFolders: string[]
}

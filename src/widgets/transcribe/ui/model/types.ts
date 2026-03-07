import type { DisplayLocale } from '../../../../entities/widget/model/types'
import type { TranscribeTextKey } from '../../i18n'

export type BrowserEntry = {
  name: string
  path: string
  type: 'dir' | 'file'
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

export type StatusDescriptor = {
  key: TranscribeTextKey
  vars?: Record<string, string | number>
}

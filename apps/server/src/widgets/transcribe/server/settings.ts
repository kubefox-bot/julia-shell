import {
  getTranscribeWidgetSettings,
  listRecentFolders,
  saveTranscribeWidgetSettings,
} from '@core/db/transcribe-repository'
import { secrets } from '@core/secrets/secrets'
import { logger } from '../../../shared/lib/logger'
import { WIDGET_ENV_NAME, WIDGET_ID } from './constants'
import type { SecretState, TranscribeSettingsPayload } from './types'
import { buildAvailableModels, resolveConfiguredModel } from './utils'

export async function resolveApiKeyState(agentId: string): Promise<SecretState> {
  const rootHealthSecret = await secrets.get('HEALTH', '/')
  logger.dev('[secrets] root HEALTH', rootHealthSecret)

  const infisicalSecret = await secrets.get('GEMINI_API_KEY', WIDGET_ENV_NAME)
  if (infisicalSecret?.source === 'infisical') {
    return {
      source: 'infisical',
      value: infisicalSecret.value,
      displayValue: infisicalSecret.reference ?? 'GEMINI_API_KEY',
      editable: false,
      secretPath: infisicalSecret.path,
    }
  }

  const storedSettings = getTranscribeWidgetSettings(agentId, WIDGET_ID)
  if (storedSettings.localApiKey) {
    return {
      source: 'db',
      value: storedSettings.localApiKey,
      displayValue: storedSettings.localApiKey,
      editable: true,
      secretPath: null,
    }
  }

  const envSecret = await secrets.get('GEMINI_API_KEY')
  if (envSecret?.source === 'env') {
    return {
      source: 'env',
      value: envSecret.value,
      displayValue: envSecret.value,
      editable: true,
      secretPath: null,
    }
  }

  return {
    source: 'missing',
    value: '',
    displayValue: '',
    editable: true,
    secretPath: null,
  }
}

export async function buildSettingsPayload(agentId: string): Promise<TranscribeSettingsPayload> {
  const widgetSettings = getTranscribeWidgetSettings(agentId, WIDGET_ID)
  const secretState = await resolveApiKeyState(agentId)
  const activeModel = resolveConfiguredModel(widgetSettings.geminiModel)

  return {
    widgetId: WIDGET_ID,
    envName: WIDGET_ENV_NAME,
    geminiModel: activeModel,
    availableModels: buildAvailableModels(widgetSettings.geminiModel || activeModel),
    apiKeySource: secretState.source,
    apiKeyEditable: secretState.editable,
    apiKeyValue: secretState.displayValue,
    hasApiKey: Boolean(secretState.value),
    secretName: 'GEMINI_API_KEY',
    secretPath: secretState.secretPath,
    recentFolders: listRecentFolders(agentId, WIDGET_ID).map((entry) => entry.folderPath),
  }
}

export async function updateTranscribeSettings(agentId: string, input: { geminiModel?: string; apiKey?: string }) {
  const previous = await resolveApiKeyState(agentId)
  const current = getTranscribeWidgetSettings(agentId, WIDGET_ID)

  saveTranscribeWidgetSettings({
    agentId,
    widgetId: WIDGET_ID,
    geminiModel:
      typeof input.geminiModel === 'string' && input.geminiModel.trim()
        ? input.geminiModel
        : resolveConfiguredModel(current.geminiModel),
    localApiKey:
      previous.source === 'infisical'
        ? current.localApiKey
        : typeof input.apiKey === 'string'
          ? input.apiKey
          : current.localApiKey,
  })

  return buildSettingsPayload(agentId)
}

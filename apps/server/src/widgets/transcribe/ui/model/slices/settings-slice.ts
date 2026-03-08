import type { StateCreator } from 'zustand'
import type { TranscribeSettingsPayload } from '../types'
import type { TranscribeStore } from '../store'

export type TranscribeSettingsSlice = {
  settingsOpen: boolean
  settingsSaving: boolean
  geminiModel: string
  availableModels: string[]
  apiKeyValue: string
  apiKeyEditable: boolean
  apiKeySource: 'infisical' | 'db' | 'env' | 'missing'
  secretPath: string | null
  setSettingsOpen: (settingsOpen: boolean) => void
  setSettingsSaving: (settingsSaving: boolean) => void
  setGeminiModel: (geminiModel: string) => void
  setApiKeyValue: (apiKeyValue: string) => void
  applySettingsPayload: (payload: TranscribeSettingsPayload) => void
}

export const createTranscribeSettingsSlice: StateCreator<TranscribeStore, [], [], TranscribeSettingsSlice> = (set) => ({
  settingsOpen: false,
  settingsSaving: false,
  geminiModel: '',
  availableModels: [],
  apiKeyValue: '',
  apiKeyEditable: true,
  apiKeySource: 'missing',
  secretPath: null,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSettingsSaving: (settingsSaving) => set({ settingsSaving }),
  setGeminiModel: (geminiModel) => set({ geminiModel }),
  setApiKeyValue: (apiKeyValue) => set({ apiKeyValue }),
  applySettingsPayload: (payload) =>
    set({
      recentFolders: payload.recentFolders,
      geminiModel: payload.geminiModel,
      availableModels: payload.availableModels,
      apiKeyValue: payload.apiKeyValue,
      apiKeyEditable: payload.apiKeyEditable,
      apiKeySource: payload.apiKeySource,
      secretPath: payload.secretPath
    })
})

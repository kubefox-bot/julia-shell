import type { StateCreator } from 'zustand'
import type { SpeakerAliasEntry } from '../types'
import type { TranscribeStore } from '../store'

export type TranscribeResultSlice = {
  resultVisible: boolean
  resultText: string
  actionsLocked: boolean
  lastTranscriptFileName: string
  speakerAliases: Record<string, string>
  speakerAliasesSaving: boolean
  setResultVisible: (resultVisible: boolean) => void
  setResultText: (resultText: string | ((current: string) => string)) => void
  setActionsLocked: (actionsLocked: boolean) => void
  setLastTranscriptFileName: (lastTranscriptFileName: string) => void
  setSpeakerAliases: (speakerAliases: Record<string, string>) => void
  applySpeakerAliasEntries: (speakerAliases: SpeakerAliasEntry[]) => void
  setSpeakerAliasesSaving: (speakerAliasesSaving: boolean) => void
  resetResult: () => void
}

export const createTranscribeResultSlice: StateCreator<TranscribeStore, [], [], TranscribeResultSlice> = (set) => ({
  resultVisible: false,
  resultText: '',
  actionsLocked: false,
  lastTranscriptFileName: '',
  speakerAliases: {},
  speakerAliasesSaving: false,
  setResultVisible: (resultVisible) => set({ resultVisible }),
  setResultText: (resultText) =>
    set((state) => ({
      resultText: typeof resultText === 'function' ? resultText(state.resultText) : resultText
    })),
  setActionsLocked: (actionsLocked) => set({ actionsLocked }),
  setLastTranscriptFileName: (lastTranscriptFileName) => set({ lastTranscriptFileName }),
  setSpeakerAliases: (speakerAliases) => set({ speakerAliases }),
  applySpeakerAliasEntries: (speakerAliases) =>
    set(() => {
      const nextSpeakerAliases: Record<string, string> = {}
      for (const entry of speakerAliases) {
        const key = entry.speakerKey.trim()
        const value = entry.aliasName.trim()
        if (!key || !value) {
          continue
        }
        nextSpeakerAliases[key] = value
      }
      return { speakerAliases: nextSpeakerAliases }
    }),
  setSpeakerAliasesSaving: (speakerAliasesSaving) => set({ speakerAliasesSaving }),
  resetResult: () =>
    set({
      resultVisible: false,
      resultText: '',
      actionsLocked: false,
      lastTranscriptFileName: '',
      speakerAliasesSaving: false
    })
})

import type { StateCreator } from 'zustand'
import type { TranscribeStore } from '../store'

export type TranscribeResultSlice = {
  resultVisible: boolean
  resultText: string
  actionsLocked: boolean
  lastTranscriptFileName: string
  setResultVisible: (resultVisible: boolean) => void
  setResultText: (resultText: string | ((current: string) => string)) => void
  setActionsLocked: (actionsLocked: boolean) => void
  setLastTranscriptFileName: (lastTranscriptFileName: string) => void
  resetResult: () => void
}

export const createTranscribeResultSlice: StateCreator<TranscribeStore, [], [], TranscribeResultSlice> = (set) => ({
  resultVisible: false,
  resultText: '',
  actionsLocked: false,
  lastTranscriptFileName: '',
  setResultVisible: (resultVisible) => set({ resultVisible }),
  setResultText: (resultText) =>
    set((state) => ({
      resultText: typeof resultText === 'function' ? resultText(state.resultText) : resultText
    })),
  setActionsLocked: (actionsLocked) => set({ actionsLocked }),
  setLastTranscriptFileName: (lastTranscriptFileName) => set({ lastTranscriptFileName }),
  resetResult: () =>
    set({
      resultVisible: false,
      resultText: '',
      actionsLocked: false,
      lastTranscriptFileName: ''
    })
})

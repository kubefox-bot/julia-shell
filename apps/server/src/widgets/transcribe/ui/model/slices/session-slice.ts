import type { StateCreator } from 'zustand'
import type { TranscribeStore } from '../store'
import type { StatusDescriptor } from '../types'

export type TranscribeSessionSlice = {
  status: StatusDescriptor
  loading: boolean
  isTranscribing: boolean
  progress: number
  progressStage: string
  resultVisible: boolean
  pathPickerOpen: boolean
  setStatus: (status: StatusDescriptor) => void
  setLoading: (loading: boolean) => void
  setResultVisible: (resultVisible: boolean) => void
  setPathPickerOpen: (pathPickerOpen: boolean) => void
  updateProgress: (progress: number, progressStage: string) => void
  resetLoader: () => void
}

export const createTranscribeSessionSlice: StateCreator<TranscribeStore, [], [], TranscribeSessionSlice> = (set) => ({
  status: { key: 'statusInitial' },
  loading: false,
  isTranscribing: false,
  progress: 0,
  progressStage: '',
  resultVisible: false,
  pathPickerOpen: false,
  setStatus: (status) => set({ status }),
  setLoading: (loading) => set({ loading }),
  setResultVisible: (resultVisible) => set({ resultVisible }),
  setPathPickerOpen: (pathPickerOpen) => set({ pathPickerOpen }),
  updateProgress: (progress, progressStage) => set({ progress, progressStage }),
  resetLoader: () =>
    set({
      isTranscribing: false,
      progress: 0,
      progressStage: ''
    })
})

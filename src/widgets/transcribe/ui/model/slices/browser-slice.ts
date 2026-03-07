import type { StateCreator } from 'zustand'
import { filterSelectedAudioFiles } from '../../helpers'
import type { BrowserEntry, StatusDescriptor } from '../types'
import type { TranscribeStore } from '../store'

export type TranscribeBrowserSlice = {
  browsePath: string
  recentFolders: string[]
  entries: BrowserEntry[]
  selectedFolderPath: string | null
  selectedAudioFiles: string[]
  selectedTranscriptPath: string | null
  status: StatusDescriptor
  loading: boolean
  progress: number
  progressStage: string
  setBrowsePath: (browsePath: string) => void
  setRecentFolders: (recentFolders: string[]) => void
  setEntries: (entries: BrowserEntry[]) => void
  setSelectedFolderPath: (selectedFolderPath: string | null) => void
  setSelectedAudioFiles: (selectedAudioFiles: string[], sourceEntries?: BrowserEntry[]) => void
  setSelectedTranscriptPath: (selectedTranscriptPath: string | null) => void
  setStatus: (status: StatusDescriptor) => void
  setLoading: (loading: boolean) => void
  setProgress: (progress: number) => void
  setProgressStage: (progressStage: string) => void
  clearBrowser: () => void
}

export const createTranscribeBrowserSlice: StateCreator<TranscribeStore, [], [], TranscribeBrowserSlice> = (set, get) => ({
  browsePath: '',
  recentFolders: [],
  entries: [],
  selectedFolderPath: null,
  selectedAudioFiles: [],
  selectedTranscriptPath: null,
  status: { key: 'statusInitial' },
  loading: false,
  progress: 0,
  progressStage: '',
  setBrowsePath: (browsePath) => set({ browsePath }),
  setRecentFolders: (recentFolders) => set({ recentFolders }),
  setEntries: (entries) => set({ entries }),
  setSelectedFolderPath: (selectedFolderPath) => set({ selectedFolderPath }),
  setSelectedAudioFiles: (selectedAudioFiles, sourceEntries) =>
    set({
      selectedAudioFiles: filterSelectedAudioFiles(selectedAudioFiles, sourceEntries ?? get().entries)
    }),
  setSelectedTranscriptPath: (selectedTranscriptPath) => set({ selectedTranscriptPath }),
  setStatus: (status) => set({ status }),
  setLoading: (loading) => set({ loading }),
  setProgress: (progress) => set({ progress }),
  setProgressStage: (progressStage) => set({ progressStage }),
  clearBrowser: () =>
    set({
      browsePath: '',
      entries: [],
      selectedFolderPath: null,
      selectedAudioFiles: [],
      selectedTranscriptPath: null
    })
})

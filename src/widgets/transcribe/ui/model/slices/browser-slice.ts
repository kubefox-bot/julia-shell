import type { StateCreator } from 'zustand'
import { filterSelectedAudioFiles } from '../../helpers'
import type { BrowserEntry } from '../types'
import type { TranscribeStore } from '../store'

export type TranscribeBrowserSlice = {
  browsePath: string
  recentFolders: string[]
  entries: BrowserEntry[]
  selectedFolderPath: string | null
  selectedAudioFiles: string[]
  selectedTranscriptPath: string | null
  setBrowsePath: (browsePath: string) => void
  setRecentFolders: (recentFolders: string[]) => void
  setEntries: (entries: BrowserEntry[]) => void
  setSelectedFolderPath: (selectedFolderPath: string | null) => void
  setSelectedAudioFiles: (selectedAudioFiles: string[], sourceEntries?: BrowserEntry[]) => void
  setSelectedTranscriptPath: (selectedTranscriptPath: string | null) => void
  clearBrowser: () => void
}

export const createTranscribeBrowserSlice: StateCreator<TranscribeStore, [], [], TranscribeBrowserSlice> = (set, get) => ({
  browsePath: '',
  recentFolders: [],
  entries: [],
  selectedFolderPath: null,
  selectedAudioFiles: [],
  selectedTranscriptPath: null,
  setBrowsePath: (browsePath) => set({ browsePath }),
  setRecentFolders: (recentFolders) => set({ recentFolders }),
  setEntries: (entries) => set({ entries }),
  setSelectedFolderPath: (selectedFolderPath) => set({ selectedFolderPath }),
  setSelectedAudioFiles: (selectedAudioFiles, sourceEntries) =>
    set({
      selectedAudioFiles: filterSelectedAudioFiles(selectedAudioFiles, sourceEntries ?? get().entries)
    }),
  setSelectedTranscriptPath: (selectedTranscriptPath) => set({ selectedTranscriptPath }),
  clearBrowser: () =>
    set({
      browsePath: '',
      entries: [],
      selectedFolderPath: null,
      selectedAudioFiles: [],
      selectedTranscriptPath: null
    })
})

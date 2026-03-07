import { createContext, useContext, useRef, type ReactNode } from 'react'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { createTranscribeBrowserSlice, type TranscribeBrowserSlice } from './slices/browser-slice'
import { createTranscribeResultSlice, type TranscribeResultSlice } from './slices/result-slice'
import { createTranscribeSettingsSlice, type TranscribeSettingsSlice } from './slices/settings-slice'

export type TranscribeStore = TranscribeBrowserSlice & TranscribeResultSlice & TranscribeSettingsSlice

export function createTranscribeStore() {
  return createStore<TranscribeStore>()((...args) => ({
    ...createTranscribeBrowserSlice(...args),
    ...createTranscribeResultSlice(...args),
    ...createTranscribeSettingsSlice(...args)
  }))
}

const TranscribeStoreContext = createContext<StoreApi<TranscribeStore> | null>(null)

export function TranscribeStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<StoreApi<TranscribeStore> | null>(null)

  if (storeRef.current === null) {
    storeRef.current = createTranscribeStore()
  }

  return <TranscribeStoreContext.Provider value={storeRef.current}>{children}</TranscribeStoreContext.Provider>
}

export function useTranscribeStore<T>(selector: (state: TranscribeStore) => T) {
  const store = useContext(TranscribeStoreContext)
  if (store === null) {
    throw new Error('Transcribe store provider is missing.')
  }

  return useStore(store, selector)
}

export function useTranscribeStoreApi() {
  const store = useContext(TranscribeStoreContext)
  if (store === null) {
    throw new Error('Transcribe store provider is missing.')
  }

  return store
}

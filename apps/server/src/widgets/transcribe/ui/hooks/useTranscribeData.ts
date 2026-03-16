import { useCallback, useEffect } from 'react'
import { subscribePassportStatusChanged } from '@passport/client'
import type { StoreApi } from 'zustand/vanilla'
import {
  isSupportedAudioEntry,
} from '../helpers'
import {
  fetchSpeakerAliases,
  fetchTranscribeFolder,
  fetchTranscribeProvider,
  fetchTranscribeSettings,
} from '../lib/transcribe-api'
import { toSpeakerAliasRecord } from '../lib/speaker-aliases'
import type { TranscribeStore } from '../model/store'
import type { StatusDescriptor } from '../model/types'
import type { LoadPathOptions } from './types'

type SetStatus = (key: StatusDescriptor['key'], vars?: Record<string, string | number>) => void
type IsCancelled = () => boolean

function shouldSkipPathLoad(value: string, options: LoadPathOptions | undefined, setStatus: SetStatus) {
  if (value || options?.allowEmpty) {
    return false
  }
  setStatus('statusEnterPath')
  return true
}

function handleLoadPathSuccess(
  store: StoreApi<TranscribeStore>,
  setStatus: SetStatus,
  nextPath: Awaited<ReturnType<typeof fetchTranscribeFolder>>,
  options: LoadPathOptions | undefined
) {
  store.setState({
    entries: nextPath.entries,
    browsePath: nextPath.path,
    selectedFolderPath: nextPath.path,
    recentFolders: nextPath.recentFolders,
    selectedAudioFiles: [],
  })
  store.getState().setSelectedAudioFiles(options?.preserveSelection ?? [], nextPath.entries)

  if (!options?.silent) {
    const hasAudio = nextPath.entries.some((entry) => isSupportedAudioEntry(entry))
    setStatus(hasAudio ? 'statusFolderReady' : 'statusFolderEmpty')
  }
}

function handleLoadPathError(
  store: StoreApi<TranscribeStore>,
  setStatus: SetStatus,
  options: LoadPathOptions | undefined,
  error: unknown
) {
  store.setState({
    entries: [],
    selectedFolderPath: null,
    selectedAudioFiles: [],
    selectedTranscriptPath: null,
  })
  if (!options?.silent) {
    setStatus('statusError', {
      message: error instanceof Error ? error.message : 'Path read failed.',
    })
  }
}

export function useTranscribeData(store: StoreApi<TranscribeStore>, setStatus: SetStatus) {
  const ensureProviderReady = useCallback(async () => {
    const provider = await fetchTranscribeProvider()
    store.getState().setProviderState(provider.ready, provider.reason ?? null)
    if (provider.ready) {
      return true
    }

    store.getState().clearBrowser()
    setStatus('statusWidgetUnavailable', {
      message: provider.reason ?? 'Widget is not available.',
    })
    return false
  }, [setStatus, store])

  const loadPathEntries = useCallback(
    async (inputPath: string, options?: LoadPathOptions) => {
      const value = inputPath.trim()
      if (shouldSkipPathLoad(value, options, setStatus)) {
        return
      }

      if (!options?.silent) {
        store.getState().setLoading(true)
        setStatus('statusLoadingPath')
      }

      try {
        const data = await fetchTranscribeFolder(value)
        handleLoadPathSuccess(store, setStatus, data, options)
      } catch (error) {
        handleLoadPathError(store, setStatus, options, error)
      } finally {
        if (!options?.silent) {
          store.getState().setLoading(false)
        }
      }
    },
    [setStatus, store]
  )

  const loadSpeakerAliases = useCallback(async () => {
    try {
      const aliases = await fetchSpeakerAliases()
      const nextAliases = toSpeakerAliasRecord(aliases)
      store.getState().setSpeakerAliases(nextAliases)
      return nextAliases
    } catch (error) {
      setStatus('statusError', {
        message: error instanceof Error ? error.message : 'Speaker aliases load failed.',
      })
      return store.getState().speakerAliases
    }
  }, [setStatus, store])

  const runInitialize = useCallback(async (isCancelled: IsCancelled) => {
    const isReady = await ensureProviderReady()
    if (!isReady || isCancelled()) {
      return
    }

    const settings = await fetchTranscribeSettings()
    if (isCancelled()) {
      return
    }

    store.getState().applySettingsPayload(settings)
    await loadSpeakerAliases()
    await loadPathEntries(settings.recentFolders[0] ?? '', { allowEmpty: true })
  }, [ensureProviderReady, loadPathEntries, loadSpeakerAliases, store])

  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      setStatus('statusSettingsLoading')
      try {
        await runInitialize(() => cancelled)
      } catch (error) {
        if (!cancelled) {
          setStatus('statusError', {
            message: error instanceof Error ? error.message : 'Settings load failed.',
          })
        }
      }
    }

    void initialize()
    return () => {
      cancelled = true
    }
  }, [runInitialize, setStatus])

  useEffect(() => {
    return subscribePassportStatusChanged((event) => {
      if (event.status !== 'connected') {
        return
      }

      const state = store.getState()
      const targetPath = (state.selectedFolderPath ?? state.browsePath ?? '').trim()
      if (!targetPath) {
        return
      }

      void loadPathEntries(targetPath, {
        allowEmpty: true,
        preserveSelection: state.selectedAudioFiles,
        silent: true,
      })
    })
  }, [loadPathEntries, store])

  return {
    ensureProviderReady,
    loadPathEntries,
    loadSpeakerAliases,
  }
}

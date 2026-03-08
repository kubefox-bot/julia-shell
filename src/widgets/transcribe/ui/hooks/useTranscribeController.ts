import { useCallback, useEffect } from 'react'
import type { WidgetRenderProps } from '../../../../entities/widget/model/types'
import { getTranscribeText } from '../../i18n'
import {
  findMatchingTranscriptPath,
  findReadableAudioPath,
  formatSelectedAudioFiles,
  isSupportedAudioEntry
} from '../helpers'
import {
  fetchSpeakerAliases,
  fetchTranscribeFolder,
  fetchTranscribeSettings,
  openTranscribeStream,
  readTranscript,
  saveSpeakerAliases,
  saveTranscript,
  saveTranscribeSettings
} from '../lib/transcribe-api'
import { toSpeakerAliasPayload, toSpeakerAliasRecord } from '../lib/speaker-aliases'
import { consumeTranscribeStream } from '../lib/transcribe-stream'
import { useTranscribeStore, useTranscribeStoreApi } from '../model/store'
import type { BrowserEntry, SpeakerAliasEntry, StatusDescriptor } from '../model/types'
import type { LoadPathOptions } from './types'
import { useTypewriterReveal } from './useTypewriterReveal'

export function useTranscribeController(props: WidgetRenderProps) {
  const store = useTranscribeStoreApi()
  const browsePath = useTranscribeStore((state) => state.browsePath)
  const recentFolders = useTranscribeStore((state) => state.recentFolders)
  const entries = useTranscribeStore((state) => state.entries)
  const selectedFolderPath = useTranscribeStore((state) => state.selectedFolderPath)
  const selectedAudioFiles = useTranscribeStore((state) => state.selectedAudioFiles)
  const selectedTranscriptPath = useTranscribeStore((state) => state.selectedTranscriptPath)
  const status = useTranscribeStore((state) => state.status)
  const loading = useTranscribeStore((state) => state.loading)
  const isTranscribing = useTranscribeStore((state) => state.isTranscribing)
  const progress = useTranscribeStore((state) => state.progress)
  const progressStage = useTranscribeStore((state) => state.progressStage)
  const resultVisible = useTranscribeStore((state) => state.resultVisible)
  const pathPickerOpen = useTranscribeStore((state) => state.pathPickerOpen)
  const resultText = useTranscribeStore((state) => state.resultText)
  const actionsLocked = useTranscribeStore((state) => state.actionsLocked)
  const speakerAliases = useTranscribeStore((state) => state.speakerAliases)
  const speakerAliasesSaving = useTranscribeStore((state) => state.speakerAliasesSaving)
  const settingsOpen = useTranscribeStore((state) => state.settingsOpen)
  const settingsSaving = useTranscribeStore((state) => state.settingsSaving)
  const geminiModel = useTranscribeStore((state) => state.geminiModel)
  const apiKeyValue = useTranscribeStore((state) => state.apiKeyValue)
  const apiKeyEditable = useTranscribeStore((state) => state.apiKeyEditable)

  const readableAudioPath = findReadableAudioPath(selectedAudioFiles, entries)

  const setStatus = useCallback((key: StatusDescriptor['key'], vars?: Record<string, string | number>) => {
    store.getState().setStatus({ key, vars })
  }, [store])

  const typewriter = useTypewriterReveal({
    onChunk: (chunk) => {
      store.getState().setResultText((prev) => prev + chunk)
    },
    onComplete: () => {
      store.getState().setActionsLocked(false)
    }
  })

  useEffect(() => {
    store.getState().setSelectedTranscriptPath(findMatchingTranscriptPath(readableAudioPath, entries))
  }, [entries, readableAudioPath, store])

  const loadPathEntries = useCallback(async (inputPath: string, options?: LoadPathOptions) => {
    const value = inputPath.trim()
    if (!value && !options?.allowEmpty) {
      setStatus('statusEnterPath')
      return
    }

    if (!options?.silent) {
      store.getState().setLoading(true)
      setStatus('statusLoadingPath')
    }

    try {
      const data = await fetchTranscribeFolder(value)
      const nextEntries = data.entries
      store.setState({
        entries: nextEntries,
        browsePath: data.path,
        selectedFolderPath: data.path,
        recentFolders: data.recentFolders,
        selectedAudioFiles: []
      })

      const nextSelection = options?.preserveSelection ?? []
      store.getState().setSelectedAudioFiles(nextSelection, nextEntries)

      if (!options?.silent) {
        const hasAudio = nextEntries.some((entry) => isSupportedAudioEntry(entry))
        setStatus(hasAudio ? 'statusFolderReady' : 'statusFolderEmpty')
      }
    } catch (error) {
      store.setState({
        entries: [],
        selectedFolderPath: null,
        selectedAudioFiles: [],
        selectedTranscriptPath: null
      })
      if (!options?.silent) {
        setStatus('statusError', {
          message: error instanceof Error ? error.message : 'Path read failed.'
        })
      }
    } finally {
      if (!options?.silent) {
        store.getState().setLoading(false)
      }
    }
  }, [setStatus, store])

  const loadSpeakerAliases = useCallback(async () => {
    try {
      const aliases = await fetchSpeakerAliases()
      const nextAliases = toSpeakerAliasRecord(aliases)
      store.getState().setSpeakerAliases(nextAliases)
      return nextAliases
    } catch (error) {
      setStatus('statusError', {
        message: error instanceof Error ? error.message : 'Speaker aliases load failed.'
      })
      return store.getState().speakerAliases
    }
  }, [setStatus, store])

  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      setStatus('statusSettingsLoading')

      try {
        const settings = await fetchTranscribeSettings()
        if (cancelled) {
          return
        }

        store.getState().applySettingsPayload(settings)
        await loadSpeakerAliases()
        await loadPathEntries(settings.recentFolders[0] ?? '', { allowEmpty: true })
      } catch (error) {
        if (!cancelled) {
          setStatus('statusError', {
            message: error instanceof Error ? error.message : 'Settings load failed.'
          })
        }
      }
    }

    void initialize()

    return () => {
      cancelled = true
    }
  }, [loadPathEntries, loadSpeakerAliases, setStatus, store])

  const openSetupView = useCallback(() => {
    typewriter.stop()
    store.getState().resetLoader()
    store.getState().setResultVisible(false)
    store.getState().setActionsLocked(false)
  }, [store, typewriter])

  const openTranscriptResult = useCallback((transcript: string, fileName: string, skipAnimation: boolean) => {
    typewriter.stop()
    store.getState().setResultText(skipAnimation ? transcript : '')
    store.getState().setLastTranscriptFileName(fileName)
    store.getState().setActionsLocked(!skipAnimation)
    store.getState().setResultVisible(true)

    if (skipAnimation) {
      return
    }

    typewriter.enqueue(transcript)
  }, [store, typewriter])

  const onTranscribe = useCallback(async () => {
    if (!selectedFolderPath) {
      setStatus('statusSelectFolderFirst')
      return
    }

    if (selectedAudioFiles.length === 0) {
      setStatus('statusSelectAudioFirst')
      return
    }

    typewriter.stop()
    store.setState({
      loading: true,
      isTranscribing: true,
      resultVisible: true,
      progress: 1,
      progressStage: '',
      resultText: '',
      actionsLocked: true
    })
    setStatus('statusTranscribing')

    try {
      const stream = await openTranscribeStream({
        folderPath: selectedFolderPath,
        filePaths: selectedAudioFiles
      })

      await consumeTranscribeStream(stream, {
        onProgress: (percent, stage) => {
          store.getState().updateProgress(Math.max(0, Math.min(100, Math.round(percent))), stage)
        },
        onToken: (text) => {
          if (!text) {
            return
          }

          setStatus('statusTyping')
          typewriter.enqueue(text)
        },
        onDone: async ({ transcript, savePath }) => {
          if (transcript) {
            typewriter.stop()
            store.getState().setResultText(transcript)
          }

          if (savePath) {
            const fileName = savePath.split(/[\\/]/).pop() ?? savePath
            store.setState({
              lastTranscriptFileName: fileName,
              selectedTranscriptPath: savePath
            })
            setStatus('statusTranscriptionDone', { file: fileName })
          } else {
            setStatus('statusTranscriptionDoneGeneric')
          }

          store.setState({
            isTranscribing: false,
            progress: 100,
            progressStage: 'progressDone',
            actionsLocked: false
          })

          if (selectedFolderPath) {
            await loadPathEntries(selectedFolderPath, {
              allowEmpty: true,
              preserveSelection: selectedAudioFiles,
              silent: true
            })
          }
        }
      })
    } catch (error) {
      store.getState().setActionsLocked(false)
      setStatus('statusError', {
        message: error instanceof Error ? error.message : 'Transcription failed.'
      })
    } finally {
      store.getState().setLoading(false)
      store.getState().resetLoader()
    }
  }, [loadPathEntries, selectedAudioFiles, selectedFolderPath, setStatus, store, typewriter])

  const onOpenTxt = useCallback(async () => {
    const primarySelectedAudio = readableAudioPath
    if (!primarySelectedAudio || !selectedTranscriptPath) {
      setStatus('statusNoTxt')
      return
    }

    store.getState().setLoading(true)
    store.getState().resetLoader()
    setStatus('statusOpenTxt')

    try {
      const data = await readTranscript({
        sourceFile: primarySelectedAudio,
        folderPath: selectedFolderPath,
        txtPath: selectedTranscriptPath
      })

      const txtPath = typeof data.txtPath === 'string' ? data.txtPath : selectedTranscriptPath
      const transcript = typeof data.transcript === 'string' ? data.transcript : ''
      const fileName = txtPath.split(/[\\/]/).pop() ?? txtPath
      openTranscriptResult(transcript, fileName, true)
      setStatus('statusOpenedFile', { file: txtPath })
    } catch (error) {
      setStatus('statusError', {
        message: error instanceof Error ? error.message : 'Txt read failed.'
      })
    } finally {
      store.getState().setLoading(false)
    }
  }, [openTranscriptResult, readableAudioPath, selectedFolderPath, selectedTranscriptPath, setStatus, store])

  const onCopy = useCallback(async () => {
    const currentText = store.getState().resultText
    if (!currentText.trim()) {
      return
    }

    try {
      await navigator.clipboard.writeText(currentText)
      setStatus('statusCopied')
    } catch {
      setStatus('statusCopyFailed')
    }
  }, [setStatus, store])

  const toggleSelectedAudioFile = useCallback((filePath: string) => {
    const current = store.getState().selectedAudioFiles
    const currentEntries = store.getState().entries
    const currentIndex = current.findIndex((value) => value.toLowerCase() === filePath.toLowerCase())

    if (currentIndex >= 0) {
      const next = [...current]
      next.splice(currentIndex, 1)
      store.getState().setSelectedAudioFiles(next, currentEntries)
      return false
    }

    store.getState().setSelectedAudioFiles([...current, filePath], currentEntries)
    return true
  }, [store])

  const onEntryClick = useCallback((entry: BrowserEntry) => {
    if (entry.type === 'dir') {
      void loadPathEntries(entry.path)
      return
    }

    if (!isSupportedAudioEntry(entry)) {
      setStatus('statusSelectSupportedFile')
      return
    }

    const added = toggleSelectedAudioFile(entry.path)
    setStatus(added ? 'statusFolderAdded' : 'statusFolderRemoved', {
      file: entry.name
    })
  }, [loadPathEntries, setStatus, toggleSelectedAudioFile])

  const onUp = useCallback(() => {
    const current = browsePath.replace(/[\\/]+$/, '')
    if (!current) {
      return
    }

    const lastSeparator = Math.max(current.lastIndexOf('\\'), current.lastIndexOf('/'))
    if (lastSeparator <= 2) {
      void loadPathEntries(current)
      return
    }

    void loadPathEntries(current.slice(0, lastSeparator))
  }, [browsePath, loadPathEntries])

  const onClearPath = useCallback(() => {
    store.getState().clearBrowser()
    store.getState().setPathPickerOpen(false)
    setStatus('statusPathCleared')
  }, [setStatus, store])

  const onSaveSettings = useCallback(async () => {
    store.getState().setSettingsSaving(true)

    try {
      const settings = await saveTranscribeSettings({
        geminiModel,
        apiKey: apiKeyEditable ? apiKeyValue : undefined
      })

      store.getState().applySettingsPayload(settings)
      store.getState().setSettingsOpen(false)
      setStatus('statusSettingsSaved')
    } catch (error) {
      setStatus('statusError', {
        message: error instanceof Error ? error.message : getTranscribeText(props.locale, 'statusSettingsSaveFailed')
      })
    } finally {
      store.getState().setSettingsSaving(false)
    }
  }, [apiKeyEditable, apiKeyValue, geminiModel, props.locale, setStatus, store])

  const onSaveSpeakerAliases = useCallback(async (entries: SpeakerAliasEntry[]) => {
    store.getState().setSpeakerAliasesSaving(true)

    try {
      const aliases = await saveSpeakerAliases(toSpeakerAliasPayload(entries))
      store.getState().setSpeakerAliases(toSpeakerAliasRecord(aliases))
      setStatus('statusSpeakerAliasesSaved')
      return true
    } catch {
      setStatus('statusSpeakerAliasesSaveFailed')
      return false
    } finally {
      store.getState().setSpeakerAliasesSaving(false)
    }
  }, [setStatus, store])

  const onSaveResult = useCallback(async (transcript: string) => {
    if (!transcript.trim()) {
      return false
    }

    if (!selectedTranscriptPath && !readableAudioPath) {
      setStatus('statusNoTxt')
      return false
    }

    store.getState().setLoading(true)

    try {
      const data = await saveTranscript({
        sourceFile: readableAudioPath,
        folderPath: selectedFolderPath,
        txtPath: selectedTranscriptPath,
        transcript
      })

      const txtPath = typeof data.txtPath === 'string' ? data.txtPath : selectedTranscriptPath
      if (txtPath) {
        store.getState().setSelectedTranscriptPath(txtPath)
        setStatus('statusResultSaved', { file: txtPath })
      } else {
        setStatus('statusTranscriptionDoneGeneric')
      }

      if (selectedFolderPath) {
        await loadPathEntries(selectedFolderPath, {
          allowEmpty: true,
          preserveSelection: selectedAudioFiles,
          silent: true
        })
      }

      return true
    } catch (error) {
      setStatus('statusError', {
        message: error instanceof Error ? error.message : getTranscribeText(props.locale, 'statusResultSaveFailed')
      })
      return false
    } finally {
      store.getState().setLoading(false)
    }
  }, [loadPathEntries, props.locale, readableAudioPath, selectedAudioFiles, selectedFolderPath, selectedTranscriptPath, setStatus, store])

  return {
    view: {
      themeClass: props.theme,
      status,
      loading,
      resultVisible,
      settingsOpen,
      isTranscribing,
      progress,
      progressStage,
      resultText,
      actionsLocked
    },
    setup: {
      browsePath,
      recentFolders,
      entries,
      selectedAudioFiles,
      selectedAudioText: formatSelectedAudioFiles(props.locale, selectedAudioFiles),
      pathPickerOpen,
      canTranscribe: !loading && Boolean(selectedFolderPath) && selectedAudioFiles.length > 0,
      canOpenTxt: !loading && Boolean(readableAudioPath) && Boolean(selectedTranscriptPath),
      onBrowsePathChange: (value: string) => store.getState().setBrowsePath(value),
      onPathSubmit: (nextPath?: string) => void loadPathEntries(nextPath ?? browsePath, { allowEmpty: true }),
      onPathPickerOpenChange: (open: boolean) => store.getState().setPathPickerOpen(open),
      onUp,
      onOpenSettings: () => store.getState().setSettingsOpen(true),
      onClearPath,
      onEntryClick,
      onTranscribe,
      onOpenTxt
    },
    result: {
      resultText,
      actionsLocked,
      speakerAliases,
      speakerAliasesSaving,
      onBack: () => {
        openSetupView()
        setStatus('statusBackToSetup')
      },
      onCopy,
      onLoadSpeakerAliases: loadSpeakerAliases,
      onSaveSpeakerAliases,
      onSaveResult
    },
    settings: {
      open: settingsOpen,
      saving: settingsSaving,
      onSave: onSaveSettings
    }
  }
}

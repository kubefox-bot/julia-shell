import { useCallback, useEffect, useRef } from 'react'
import type { WidgetRenderProps } from '../../../../entities/widget/model/types'
import { getTranscribeText } from '../../i18n'
import {
  findMatchingTranscriptPath,
  formatSelectedAudioFiles,
  isSupportedAudioEntry,
  parseSseEventChunk
} from '../helpers'
import { useTranscribeStore, useTranscribeStoreApi } from '../model/store'
import type { BrowserEntry, TranscribeSettingsPayload } from '../model/types'

type LoadPathOptions = {
  allowEmpty?: boolean
  preserveSelection?: string[]
  silent?: boolean
}

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
  const settingsOpen = useTranscribeStore((state) => state.settingsOpen)
  const settingsSaving = useTranscribeStore((state) => state.settingsSaving)
  const geminiModel = useTranscribeStore((state) => state.geminiModel)
  const apiKeyValue = useTranscribeStore((state) => state.apiKeyValue)
  const apiKeyEditable = useTranscribeStore((state) => state.apiKeyEditable)

  const typewriterQueueRef = useRef('')
  const typewriterTimerRef = useRef<number | null>(null)
  const resultTextRef = useRef('')
  const entriesRef = useRef<BrowserEntry[]>([])

  const setStatus = useCallback((key: typeof status.key, vars?: Record<string, string | number>) => {
    store.getState().setStatus({ key, vars })
  }, [status.key, store])

  useEffect(() => {
    resultTextRef.current = resultText
  }, [resultText])

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  useEffect(() => {
    return () => {
      if (typewriterTimerRef.current !== null) {
        window.clearTimeout(typewriterTimerRef.current)
        typewriterTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    store.getState().setSelectedTranscriptPath(findMatchingTranscriptPath(selectedAudioFiles[0] ?? null, entries))
  }, [entries, selectedAudioFiles, store])

  const runTypewriter = useCallback(() => {
    if (!typewriterQueueRef.current.length) {
      typewriterTimerRef.current = null
      store.getState().setActionsLocked(false)
      return
    }

    const remaining = typewriterQueueRef.current.length
    const batchSize = remaining > 220 ? 14 : remaining > 120 ? 10 : remaining > 40 ? 6 : 3
    const chunk = typewriterQueueRef.current.slice(0, batchSize)
    typewriterQueueRef.current = typewriterQueueRef.current.slice(batchSize)

    store.getState().setResultText((prev) => {
      const next = prev + chunk
      resultTextRef.current = next
      return next
    })
    typewriterTimerRef.current = window.setTimeout(runTypewriter, 22)
  }, [store])

  const ensureTypewriterRunning = useCallback(() => {
    if (typewriterTimerRef.current !== null) {
      return
    }
    typewriterTimerRef.current = window.setTimeout(runTypewriter, 22)
  }, [runTypewriter])

  const stopTypewriter = useCallback(() => {
    if (typewriterTimerRef.current !== null) {
      window.clearTimeout(typewriterTimerRef.current)
      typewriterTimerRef.current = null
    }
    typewriterQueueRef.current = ''
  }, [])

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
      const response = await fetch('/api/widget/com.yulia.transcribe/fs-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: value })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to read path.')
      }

      const nextEntries = data.entries as BrowserEntry[]
      store.setState({
        entries: nextEntries,
        browsePath: data.path as string,
        selectedFolderPath: data.path as string,
        recentFolders: Array.isArray(data.recentFolders) ? data.recentFolders as string[] : [],
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

  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      setStatus('statusSettingsLoading')

      try {
        const response = await fetch('/api/widget/com.yulia.transcribe/settings')
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load settings.')
        }

        if (cancelled) {
          return
        }

        store.getState().applySettingsPayload(data as TranscribeSettingsPayload)
        await loadPathEntries((data as TranscribeSettingsPayload).recentFolders[0] ?? '', { allowEmpty: true })
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
  }, [loadPathEntries, setStatus, store])

  const openSetupView = useCallback(() => {
    stopTypewriter()
    store.getState().resetLoader()
    store.getState().setResultVisible(false)
    store.getState().setActionsLocked(false)
  }, [stopTypewriter, store])

  const openTranscriptResult = useCallback((transcript: string, fileName: string, skipAnimation: boolean) => {
    stopTypewriter()
    resultTextRef.current = transcript
    store.getState().setResultText(skipAnimation ? transcript : '')
    store.getState().setLastTranscriptFileName(fileName)
    store.getState().setActionsLocked(!skipAnimation)
    store.getState().setResultVisible(true)

    if (skipAnimation) {
      return
    }

    typewriterQueueRef.current = transcript
    ensureTypewriterRunning()
  }, [ensureTypewriterRunning, stopTypewriter, store])

  const onTranscribe = useCallback(async () => {
    if (!selectedFolderPath) {
      setStatus('statusSelectFolderFirst')
      return
    }

    if (selectedAudioFiles.length === 0) {
      setStatus('statusSelectAudioFirst')
      return
    }

    stopTypewriter()
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
    resultTextRef.current = ''

    try {
      const response = await fetch('/api/widget/com.yulia.transcribe/transcribe-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: selectedFolderPath,
          filePaths: selectedAudioFiles
        })
      })

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Transcription failed.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finished = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')

        while (true) {
          const boundary = buffer.indexOf('\n\n')
          if (boundary === -1) {
            break
          }

          const chunk = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const parsed = parseSseEventChunk(chunk)
          if (!parsed) {
            continue
          }

          if (parsed.eventName === 'progress') {
            const percent = typeof parsed.payload.percent === 'number' ? parsed.payload.percent : 0
            const stage = typeof parsed.payload.stage === 'string' ? parsed.payload.stage : ''
            store.getState().updateProgress(Math.max(0, Math.min(100, Math.round(percent))), stage)
            continue
          }

          if (parsed.eventName === 'token') {
            const text = typeof parsed.payload.text === 'string' ? parsed.payload.text : ''
            if (text) {
              typewriterQueueRef.current += text
              setStatus('statusTyping')
              ensureTypewriterRunning()
            }
            continue
          }

          if (parsed.eventName === 'done') {
            finished = true
            const finalTranscript = typeof parsed.payload.transcript === 'string' ? parsed.payload.transcript : ''
            const savePath = typeof parsed.payload.savePath === 'string' ? parsed.payload.savePath : ''

            if (finalTranscript) {
              const known = resultTextRef.current + typewriterQueueRef.current
              if (finalTranscript.startsWith(known)) {
                typewriterQueueRef.current += finalTranscript.slice(known.length)
              } else {
                resultTextRef.current = ''
                store.getState().setResultText('')
                typewriterQueueRef.current = finalTranscript
              }
              ensureTypewriterRunning()
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

            store.getState().updateProgress(100, 'progressDone')
            if (selectedFolderPath) {
              await loadPathEntries(selectedFolderPath, {
                allowEmpty: true,
                preserveSelection: selectedAudioFiles,
                silent: true
              })
            }
            continue
          }

          if (parsed.eventName === 'error') {
            throw new Error(typeof parsed.payload.message === 'string' ? parsed.payload.message : 'Transcription error.')
          }
        }
      }

      if (!finished) {
        throw new Error('Stream finished without a result.')
      }
    } catch (error) {
      store.getState().setActionsLocked(false)
      setStatus('statusError', {
        message: error instanceof Error ? error.message : 'Transcription failed.'
      })
    } finally {
      store.getState().setLoading(false)
      store.getState().resetLoader()
    }
  }, [ensureTypewriterRunning, loadPathEntries, selectedAudioFiles, selectedFolderPath, setStatus, stopTypewriter, store])

  const onOpenTxt = useCallback(async () => {
    const primarySelectedAudio = selectedAudioFiles[0] ?? null
    if (!primarySelectedAudio || !selectedTranscriptPath) {
      setStatus('statusNoTxt')
      return
    }

    store.getState().setLoading(true)
    store.getState().resetLoader()
    setStatus('statusOpenTxt')

    try {
      const response = await fetch('/api/widget/com.yulia.transcribe/transcript-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFile: primarySelectedAudio,
          folderPath: selectedFolderPath,
          txtPath: selectedTranscriptPath
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to open .txt file.')
      }

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
  }, [openTranscriptResult, selectedAudioFiles, selectedFolderPath, selectedTranscriptPath, setStatus, store])

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
    const currentIndex = current.findIndex((value) => value.toLowerCase() === filePath.toLowerCase())
    if (currentIndex >= 0) {
      const next = [...current]
      next.splice(currentIndex, 1)
      store.getState().setSelectedAudioFiles(next, entriesRef.current)
      return false
    }

    store.getState().setSelectedAudioFiles([...current, filePath], entriesRef.current)
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
      const response = await fetch('/api/widget/com.yulia.transcribe/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiModel,
          apiKey: apiKeyEditable ? apiKeyValue : undefined
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save settings.')
      }

      store.getState().applySettingsPayload(data as TranscribeSettingsPayload)
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
      canOpenTxt: !loading && Boolean(selectedAudioFiles[0]) && Boolean(selectedTranscriptPath),
      onBrowsePathChange: (value: string) => store.getState().setBrowsePath(value),
      onPathSubmit: () => void loadPathEntries(browsePath, { allowEmpty: true }),
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
      onBack: () => {
        openSetupView()
        setStatus('statusBackToSetup')
      },
      onCopy
    },
    settings: {
      open: settingsOpen,
      saving: settingsSaving,
      onSave: onSaveSettings
    }
  }
}

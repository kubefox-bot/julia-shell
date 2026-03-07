import { useCallback, useEffect, useRef } from 'react'
import type { WidgetRenderProps } from '../../../entities/widget/model/types'
import { getTranscribeText } from '../i18n'
import { SetupView } from './components/SetupView'
import { ResultView } from './components/ResultView'
import { SettingsModal } from './components/SettingsModal'
import {
  findMatchingTranscriptPath,
  isSupportedAudioEntry,
  parseSseEventChunk,
  upsertEntry
} from './helpers'
import { TranscribeStoreProvider, useTranscribeStore, useTranscribeStoreApi } from './model/store'
import type { BrowserEntry, TranscribeSettingsPayload } from './model/types'
import styles from './TranscribeWidget.module.scss'

function TranscribeWidgetInner(props: WidgetRenderProps) {
  const themeClass = props.theme === 'night' ? styles.night : styles.day
  const store = useTranscribeStoreApi()

  const browsePath = useTranscribeStore((state) => state.browsePath)
  const entries = useTranscribeStore((state) => state.entries)
  const selectedFolderPath = useTranscribeStore((state) => state.selectedFolderPath)
  const selectedAudioFiles = useTranscribeStore((state) => state.selectedAudioFiles)
  const status = useTranscribeStore((state) => state.status)
  const loading = useTranscribeStore((state) => state.loading)
  const resultVisible = useTranscribeStore((state) => state.resultVisible)
  const resultText = useTranscribeStore((state) => state.resultText)
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
    store.setState({ status: { key, vars } })
  }, [store])

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
      window.speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => {
    store.getState().setSelectedTranscriptPath(findMatchingTranscriptPath(selectedAudioFiles[0] ?? null, entries))
  }, [entries, selectedAudioFiles, store])

  const openSetupView = useCallback(() => {
    if (typewriterTimerRef.current !== null) {
      window.clearTimeout(typewriterTimerRef.current)
      typewriterTimerRef.current = null
    }
    typewriterQueueRef.current = ''
    store.setState({
      actionsLocked: false,
      resultVisible: false
    })
  }, [store])

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
    if (typewriterTimerRef.current !== null) return
    typewriterTimerRef.current = window.setTimeout(runTypewriter, 22)
  }, [runTypewriter])

  const loadPathEntries = useCallback(async (inputPath: string, options?: { allowEmpty?: boolean }) => {
    const value = inputPath.trim()
    if (!value && !options?.allowEmpty) {
      setStatus('statusEnterPath')
      return
    }

    store.setState({ loading: true })
    setStatus('statusLoadingPath')

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

      const hasAudio = nextEntries.some((entry) => isSupportedAudioEntry(entry))
      setStatus(hasAudio ? 'statusFolderReady' : 'statusFolderEmpty')
    } catch (error) {
      store.setState({
        entries: [],
        selectedFolderPath: null,
        selectedAudioFiles: [],
        selectedTranscriptPath: null
      })
      setStatus('statusError', {
        message: error instanceof Error ? error.message : 'Path read failed.'
      })
    } finally {
      store.setState({ loading: false })
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

        if (cancelled) return
        store.getState().applySettingsPayload(data as TranscribeSettingsPayload)
        await loadPathEntries(((data as TranscribeSettingsPayload).recentFolders[0] ?? ''), { allowEmpty: true })
      } catch (error) {
        if (cancelled) return
        setStatus('statusError', {
          message: error instanceof Error ? error.message : 'Settings load failed.'
        })
      }
    }

    void initialize()
    return () => {
      cancelled = true
    }
  }, [loadPathEntries, setStatus, store])

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

  const onTranscribe = useCallback(async () => {
    if (!selectedFolderPath) {
      setStatus('statusSelectFolderFirst')
      return
    }

    if (selectedAudioFiles.length === 0) {
      setStatus('statusSelectAudioFirst')
      return
    }

    store.setState({
      loading: true,
      progress: 1,
      progressStage: '',
      resultVisible: true,
      resultText: '',
      actionsLocked: true
    })
    setStatus('statusTranscribing')
    resultTextRef.current = ''
    typewriterQueueRef.current = ''

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
        if (done) break

        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')

        while (true) {
          const boundary = buffer.indexOf('\n\n')
          if (boundary === -1) break

          const chunk = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const parsed = parseSseEventChunk(chunk)
          if (!parsed) continue

          if (parsed.eventName === 'progress') {
            const percent = typeof parsed.payload.percent === 'number' ? parsed.payload.percent : 0
            const stage = typeof parsed.payload.stage === 'string' ? parsed.payload.stage : ''
            store.setState({
              progress: Math.max(0, Math.min(100, Math.round(percent))),
              progressStage: stage
            })
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
                store.getState().setResultText('')
                resultTextRef.current = ''
                typewriterQueueRef.current = finalTranscript
              }
              ensureTypewriterRunning()
            }

            if (savePath) {
              const fileName = savePath.split(/[\\/]/).pop() ?? savePath
              store.setState({
                lastTranscriptFileName: fileName,
                selectedTranscriptPath: savePath,
                entries: upsertEntry(store.getState().entries, {
                  name: fileName,
                  path: savePath,
                  type: 'file'
                }),
                progress: 100,
                progressStage: 'progressDone'
              })
              setStatus('statusTranscriptionDone', { file: fileName })
            } else {
              store.setState({
                progress: 100,
                progressStage: 'progressDone'
              })
              setStatus('statusTranscriptionDoneGeneric')
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
      store.setState({ actionsLocked: false })
      setStatus('statusError', {
        message: error instanceof Error ? error.message : 'Transcription failed.'
      })
    } finally {
      store.setState({ loading: false })
    }
  }, [ensureTypewriterRunning, selectedAudioFiles, selectedFolderPath, setStatus, store])

  const onReadAloud = useCallback(() => {
    const currentText = store.getState().resultText
    if (!currentText.trim()) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(currentText)
    utterance.lang = props.locale === 'ru' ? 'ru-RU' : 'en-US'
    window.speechSynthesis.speak(utterance)
  }, [props.locale, store])

  const onCopy = useCallback(async () => {
    const currentText = store.getState().resultText
    if (!currentText.trim()) return
    try {
      await navigator.clipboard.writeText(currentText)
      setStatus('statusCopied')
    } catch {
      setStatus('statusCopyFailed')
    }
  }, [setStatus, store])

  const onSave = useCallback(() => {
    const state = store.getState()
    if (!state.resultText.trim()) return
    const blob = new Blob([state.resultText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = state.lastTranscriptFileName || 'transcript.txt'
    link.click()
    URL.revokeObjectURL(url)
    setStatus('statusSaved')
  }, [setStatus, store])

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
    if (!current) return

    const lastSeparator = Math.max(current.lastIndexOf('\\'), current.lastIndexOf('/'))
    if (lastSeparator <= 2) {
      void loadPathEntries(current)
      return
    }

    void loadPathEntries(current.slice(0, lastSeparator))
  }, [browsePath, loadPathEntries])

  const onSaveSettings = useCallback(async () => {
    store.setState({ settingsSaving: true })

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
      store.setState({ settingsOpen: false })
      setStatus('statusSettingsSaved')
    } catch (error) {
      setStatus('statusError', {
        message: error instanceof Error ? error.message : getTranscribeText(props.locale, 'statusSettingsSaveFailed')
      })
    } finally {
      store.setState({ settingsSaving: false })
    }
  }, [apiKeyEditable, apiKeyValue, geminiModel, props.locale, setStatus, store])

  return (
    <div className={[styles.root, themeClass].join(' ')}>
      {settingsOpen ? <SettingsModal locale={props.locale} platform={props.platform} onSave={onSaveSettings} /> : null}

      {!resultVisible ? (
        <SetupView
          locale={props.locale}
          onLoadPathEntries={loadPathEntries}
          onEntryClick={onEntryClick}
          onUp={onUp}
          onOpenSettings={() => store.setState({ settingsOpen: true })}
          onTranscribe={onTranscribe}
        />
      ) : (
        <ResultView
          locale={props.locale}
          onBack={() => {
            openSetupView()
            setStatus('statusBackToSetup')
          }}
          onReadAloud={onReadAloud}
          onCopy={onCopy}
          onSave={onSave}
        />
      )}

      <p className={styles.status}>{getTranscribeText(props.locale, status.key, status.vars)}</p>
    </div>
  )
}

export function TranscribeWidget(props: WidgetRenderProps) {
  return (
    <TranscribeStoreProvider>
      <TranscribeWidgetInner {...props} />
    </TranscribeStoreProvider>
  )
}

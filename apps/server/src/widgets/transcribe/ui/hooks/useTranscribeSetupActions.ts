import { useCallback } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import { isSupportedAudioEntry } from '../helpers'
import { openTranscribeStream, readTranscript } from '../lib/transcribe-api'
import { consumeTranscribeStream } from '../lib/transcribe-stream'
import type { TranscribeStore } from '../model/store'
import type { BrowserEntry, StatusDescriptor } from '../model/types'
import type { LoadPathOptions } from './types'

const MAX_PROGRESS_PERCENT = 100

type SetStatus = (key: StatusDescriptor['key'], vars?: Record<string, string | number>) => void
type TypewriterController = {
  stop: () => void
  enqueue: (text: string) => void
}

type SetupActionsInput = {
  store: StoreApi<TranscribeStore>
  browsePath: string
  selectedFolderPath: string | null
  selectedAudioFiles: string[]
  selectedTranscriptPath: string | null
  readableAudioPath: string | null
  ensureProviderReady: () => Promise<boolean>
  loadPathEntries: (inputPath: string, options?: LoadPathOptions) => Promise<void>
  setStatus: SetStatus
  typewriter: TypewriterController
}

function toggleSelectedAudioFile(store: StoreApi<TranscribeStore>, filePath: string) {
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
}

export function useTranscribeSetupActions(input: SetupActionsInput) {
  const openSetupView = useCallback(() => {
    input.typewriter.stop()
    input.store.getState().resetLoader()
    input.store.getState().setResultVisible(false)
    input.store.getState().setActionsLocked(false)
  }, [input])

  const openTranscriptResult = useCallback((transcript: string, fileName: string, skipAnimation: boolean) => {
    input.typewriter.stop()
    input.store.getState().setResultText(skipAnimation ? transcript : '')
    input.store.getState().setLastTranscriptFileName(fileName)
    input.store.getState().setActionsLocked(!skipAnimation)
    input.store.getState().setResultVisible(true)
    if (!skipAnimation) {
      input.typewriter.enqueue(transcript)
    }
  }, [input])

  const onTranscribe = useCallback(async () => {
    const isReady = await input.ensureProviderReady()
    if (!isReady) {
      return
    }
    if (!input.selectedFolderPath) {
      input.setStatus('statusSelectFolderFirst')
      return
    }
    if (input.selectedAudioFiles.length === 0) {
      input.setStatus('statusSelectAudioFirst')
      return
    }

    input.typewriter.stop()
    input.store.setState({
      loading: true,
      isTranscribing: true,
      resultVisible: true,
      progress: 1,
      progressStage: '',
      resultText: '',
      actionsLocked: true,
    })
    input.setStatus('statusTranscribing')

    try {
      const stream = await openTranscribeStream({
        folderPath: input.selectedFolderPath,
        filePaths: input.selectedAudioFiles,
      })
      await consumeTranscribeStream(stream, {
        onProgress: (percent, stage) => {
          input.store.getState().updateProgress(
            Math.max(0, Math.min(MAX_PROGRESS_PERCENT, Math.round(percent))),
            stage
          )
        },
        onToken: (text) => {
          if (!text) {
            return
          }
          input.setStatus('statusTyping')
          input.typewriter.enqueue(text)
        },
        onDone: async ({ transcript, savePath }) => {
          if (transcript) {
            input.typewriter.stop()
            input.store.getState().setResultText(transcript)
          }

          if (savePath) {
            const fileName = savePath.split(/[\\/]/).pop() ?? savePath
            input.store.setState({ lastTranscriptFileName: fileName, selectedTranscriptPath: savePath })
            input.setStatus('statusTranscriptionDone', { file: fileName })
          } else {
            input.setStatus('statusTranscriptionDoneGeneric')
          }

          input.store.setState({
            isTranscribing: false,
            progress: MAX_PROGRESS_PERCENT,
            progressStage: 'progressDone',
            actionsLocked: false,
          })

          if (input.selectedFolderPath) {
            await input.loadPathEntries(input.selectedFolderPath, {
              allowEmpty: true,
              preserveSelection: input.selectedAudioFiles,
              silent: true,
            })
          }
        },
      })
    } catch (error) {
      input.store.getState().setActionsLocked(false)
      input.setStatus('statusError', {
        message: error instanceof Error ? error.message : 'Transcription failed.',
      })
    } finally {
      input.store.getState().setLoading(false)
      input.store.getState().resetLoader()
    }
  }, [input])

  const onOpenTxt = useCallback(async () => {
    if (!input.readableAudioPath || !input.selectedTranscriptPath) {
      input.setStatus('statusNoTxt')
      return
    }

    input.store.getState().setLoading(true)
    input.store.getState().resetLoader()
    input.setStatus('statusOpenTxt')
    try {
      const data = await readTranscript({
        sourceFile: input.readableAudioPath,
        folderPath: input.selectedFolderPath,
        txtPath: input.selectedTranscriptPath,
      })

      const txtPath = typeof data.txtPath === 'string' ? data.txtPath : input.selectedTranscriptPath
      const transcript = typeof data.transcript === 'string' ? data.transcript : ''
      const fileName = txtPath.split(/[\\/]/).pop() ?? txtPath
      openTranscriptResult(transcript, fileName, true)
      input.setStatus('statusOpenedFile', { file: txtPath })
    } catch (error) {
      input.setStatus('statusError', {
        message: error instanceof Error ? error.message : 'Txt read failed.',
      })
    } finally {
      input.store.getState().setLoading(false)
    }
  }, [input, openTranscriptResult])

  const onEntryClick = useCallback((entry: BrowserEntry) => {
    if (entry.type === 'dir') {
      void input.loadPathEntries(entry.path)
      return
    }
    if (!isSupportedAudioEntry(entry)) {
      input.setStatus('statusSelectSupportedFile')
      return
    }
    const added = toggleSelectedAudioFile(input.store, entry.path)
    input.setStatus(added ? 'statusFolderAdded' : 'statusFolderRemoved', { file: entry.name })
  }, [input])

  const onUp = useCallback(() => {
    const current = input.browsePath.replace(/[\\/]+$/, '')
    if (!current) {
      return
    }

    const lastSeparator = Math.max(current.lastIndexOf('\\'), current.lastIndexOf('/'))
    void input.loadPathEntries(lastSeparator <= 2 ? current : current.slice(0, lastSeparator))
  }, [input])

  const onClearPath = useCallback(() => {
    input.store.getState().clearBrowser()
    input.store.getState().setPathPickerOpen(false)
    input.setStatus('statusPathCleared')
  }, [input])

  return {
    openSetupView,
    onTranscribe,
    onOpenTxt,
    onEntryClick,
    onUp,
    onClearPath,
  }
}

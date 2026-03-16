import { useCallback } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import type { DisplayLocale } from '../../../../entities/widget/model/types'
import { getTranscribeText } from '../../i18n'
import { saveSpeakerAliases, saveTranscript, saveTranscribeSettings } from '../lib/transcribe-api'
import { toSpeakerAliasPayload, toSpeakerAliasRecord } from '../lib/speaker-aliases'
import type { TranscribeStore } from '../model/store'
import type { SpeakerAliasEntry, StatusDescriptor } from '../model/types'
import type { LoadPathOptions } from './types'

type SetStatus = (key: StatusDescriptor['key'], vars?: Record<string, string | number>) => void

type ResultActionsInput = {
  store: StoreApi<TranscribeStore>
  locale: DisplayLocale
  selectedFolderPath: string | null
  selectedAudioFiles: string[]
  selectedTranscriptPath: string | null
  readableAudioPath: string | null
  geminiModel: string
  apiKeyValue: string
  apiKeyEditable: boolean
  loadPathEntries: (inputPath: string, options?: LoadPathOptions) => Promise<void>
  setStatus: SetStatus
}

export function useTranscribeResultActions(input: ResultActionsInput) {
  const onCopy = useCallback(async () => {
    const currentText = input.store.getState().resultText
    if (!currentText.trim()) {
      return
    }

    try {
      await navigator.clipboard.writeText(currentText)
      input.setStatus('statusCopied')
    } catch {
      input.setStatus('statusCopyFailed')
    }
  }, [input])

  const onSaveSettings = useCallback(async () => {
    input.store.getState().setSettingsSaving(true)

    try {
      const settings = await saveTranscribeSettings({
        geminiModel: input.geminiModel,
        apiKey: input.apiKeyEditable ? input.apiKeyValue : undefined,
      })

      input.store.getState().applySettingsPayload(settings)
      input.store.getState().setSettingsOpen(false)
      input.setStatus('statusSettingsSaved')
    } catch (error) {
      input.setStatus('statusError', {
        message:
          error instanceof Error
            ? error.message
            : getTranscribeText(input.locale, 'statusSettingsSaveFailed'),
      })
    } finally {
      input.store.getState().setSettingsSaving(false)
    }
  }, [input])

  const onSaveSpeakerAliases = useCallback(
    async (entries: SpeakerAliasEntry[]) => {
      input.store.getState().setSpeakerAliasesSaving(true)

      try {
        const aliases = await saveSpeakerAliases(toSpeakerAliasPayload(entries))
        input.store.getState().setSpeakerAliases(toSpeakerAliasRecord(aliases))
        input.setStatus('statusSpeakerAliasesSaved')
        return true
      } catch {
        input.setStatus('statusSpeakerAliasesSaveFailed')
        return false
      } finally {
        input.store.getState().setSpeakerAliasesSaving(false)
      }
    },
    [input]
  )

  const onSaveResult = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) {
        return false
      }
      if (!input.selectedTranscriptPath && !input.readableAudioPath) {
        input.setStatus('statusNoTxt')
        return false
      }

      input.store.getState().setLoading(true)
      try {
        const data = await saveTranscript({
          sourceFile: input.readableAudioPath,
          folderPath: input.selectedFolderPath,
          txtPath: input.selectedTranscriptPath,
          transcript,
        })

        const txtPath = typeof data.txtPath === 'string' ? data.txtPath : input.selectedTranscriptPath
        if (txtPath) {
          input.store.getState().setSelectedTranscriptPath(txtPath)
          input.setStatus('statusResultSaved', { file: txtPath })
        } else {
          input.setStatus('statusTranscriptionDoneGeneric')
        }

        if (input.selectedFolderPath) {
          await input.loadPathEntries(input.selectedFolderPath, {
            allowEmpty: true,
            preserveSelection: input.selectedAudioFiles,
            silent: true,
          })
        }
        return true
      } catch (error) {
        input.setStatus('statusError', {
          message:
            error instanceof Error
              ? error.message
              : getTranscribeText(input.locale, 'statusResultSaveFailed'),
        })
        return false
      } finally {
        input.store.getState().setLoading(false)
      }
    },
    [input]
  )

  return {
    onCopy,
    onSaveSettings,
    onSaveSpeakerAliases,
    onSaveResult,
  }
}

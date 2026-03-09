import { useCallback, useEffect } from 'react'
import type { WidgetRenderProps } from '../../../../entities/widget/model/types'
import {
  findMatchingTranscriptPath,
  findReadableAudioPath,
  formatSelectedAudioFiles,
} from '../helpers'
import { useTranscribeStore, useTranscribeStoreApi } from '../model/store'
import type { StatusDescriptor } from '../model/types'
import { useTranscribeData } from './useTranscribeData'
import { useTranscribeResultActions } from './useTranscribeResultActions'
import { useTranscribeSetupActions } from './useTranscribeSetupActions'
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
  const providerReady = useTranscribeStore((state) => state.providerReady)
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
    },
  })

  useEffect(() => {
    store.getState().setSelectedTranscriptPath(findMatchingTranscriptPath(readableAudioPath, entries))
  }, [entries, readableAudioPath, store])

  const data = useTranscribeData(store, setStatus)
  const setupActions = useTranscribeSetupActions({
    store,
    browsePath,
    selectedFolderPath,
    selectedAudioFiles,
    selectedTranscriptPath,
    readableAudioPath,
    ensureProviderReady: data.ensureProviderReady,
    loadPathEntries: data.loadPathEntries,
    setStatus,
    typewriter,
  })
  const resultActions = useTranscribeResultActions({
    store,
    locale: props.locale,
    selectedFolderPath,
    selectedAudioFiles,
    selectedTranscriptPath,
    readableAudioPath,
    geminiModel,
    apiKeyValue,
    apiKeyEditable,
    loadPathEntries: data.loadPathEntries,
    setStatus,
  })

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
      actionsLocked,
    },
    setup: {
      browsePath,
      recentFolders,
      entries,
      selectedAudioFiles,
      selectedAudioText: formatSelectedAudioFiles(props.locale, selectedAudioFiles),
      pathPickerOpen,
      canOpenTxt: providerReady && !loading && Boolean(readableAudioPath) && Boolean(selectedTranscriptPath),
      canTranscribe: providerReady && !loading && Boolean(selectedFolderPath) && selectedAudioFiles.length > 0,
      onBrowsePathChange: (value: string) => store.getState().setBrowsePath(value),
      onPathSubmit: (nextPath?: string) =>
        void data.loadPathEntries(nextPath ?? browsePath, { allowEmpty: true }),
      onPathPickerOpenChange: (open: boolean) => store.getState().setPathPickerOpen(open),
      onUp: setupActions.onUp,
      onOpenSettings: () => store.getState().setSettingsOpen(true),
      onClearPath: setupActions.onClearPath,
      onEntryClick: setupActions.onEntryClick,
      onTranscribe: setupActions.onTranscribe,
      onOpenTxt: setupActions.onOpenTxt,
    },
    result: {
      resultText,
      actionsLocked,
      speakerAliases,
      speakerAliasesSaving,
      onBack: () => {
        setupActions.openSetupView()
        setStatus('statusBackToSetup')
      },
      onCopy: resultActions.onCopy,
      onLoadSpeakerAliases: data.loadSpeakerAliases,
      onSaveSpeakerAliases: resultActions.onSaveSpeakerAliases,
      onSaveResult: resultActions.onSaveResult,
    },
    settings: {
      open: settingsOpen,
      saving: settingsSaving,
      onSave: resultActions.onSaveSettings,
    },
  }
}

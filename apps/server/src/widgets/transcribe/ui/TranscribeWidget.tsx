import type { WidgetRenderProps } from '../../../entities/widget/model/types'
import { LoaderStrip } from './components/LoaderStrip'
import { ResultView } from './components/ResultView'
import { SettingsModal } from './components/SettingsModal'
import { SetupView } from './components/SetupView'
import { useTranscribeController } from './hooks/useTranscribeController'
import { TranscribeStoreProvider } from './model/store'
import styles from './TranscribeWidget.module.css'

function TranscribeWidgetInner(props: WidgetRenderProps) {
  const controller = useTranscribeController(props)
  const themeClass = props.theme === 'night' ? styles.night : styles.day

  return (
    <div className={[styles.root, themeClass].join(' ')}>
      {controller.settings.open ? (
        <SettingsModal locale={props.locale} platform={props.platform} theme={props.theme} onSave={controller.settings.onSave} />
      ) : null}

      <LoaderStrip
        locale={props.locale}
        visible={controller.view.isTranscribing}
        progress={controller.view.progress}
        progressStage={controller.view.progressStage}
      />

      {!controller.view.resultVisible ? (
        <SetupView
          locale={props.locale}
          theme={props.theme}
          browsePath={controller.setup.browsePath}
          recentFolders={controller.setup.recentFolders}
          entries={controller.setup.entries}
          selectedAudioFiles={controller.setup.selectedAudioFiles}
          selectedAudioText={controller.setup.selectedAudioText}
          loading={controller.view.loading}
          pathPickerOpen={controller.setup.pathPickerOpen}
          canTranscribe={controller.setup.canTranscribe}
          canOpenTxt={controller.setup.canOpenTxt}
          onBrowsePathChange={controller.setup.onBrowsePathChange}
          onPathSubmit={controller.setup.onPathSubmit}
          onPathPickerOpenChange={controller.setup.onPathPickerOpenChange}
          onUp={controller.setup.onUp}
          onOpenSettings={controller.setup.onOpenSettings}
          onClearPath={controller.setup.onClearPath}
          onEntryClick={controller.setup.onEntryClick}
          onTranscribe={controller.setup.onTranscribe}
          onOpenTxt={controller.setup.onOpenTxt}
        />
      ) : (
        <ResultView
          locale={props.locale}
          theme={props.theme}
          resultText={controller.result.resultText}
          actionsLocked={controller.result.actionsLocked}
          isTranscribing={controller.view.isTranscribing}
          speakerAliases={controller.result.speakerAliases}
          speakerAliasesSaving={controller.result.speakerAliasesSaving}
          onBack={controller.result.onBack}
          onCopy={controller.result.onCopy}
          onLoadSpeakerAliases={controller.result.onLoadSpeakerAliases}
          onSaveSpeakerAliases={controller.result.onSaveSpeakerAliases}
          onSaveResult={controller.result.onSaveResult}
        />
      )}

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

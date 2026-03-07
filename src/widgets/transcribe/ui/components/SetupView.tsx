import { getTranscribeText } from '../../i18n'
import type { BrowserEntry } from '../model/types'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'
import { BrowserList } from './BrowserList'
import { PathActionsRow } from './PathActionsRow'
import { SelectionSummary } from './SelectionSummary'
import { SetupActions } from './SetupActions'

type SetupViewProps = {
  locale: DisplayLocale
  browsePath: string
  recentFolders: string[]
  entries: BrowserEntry[]
  selectedAudioFiles: string[]
  selectedAudioText: string
  loading: boolean
  pathPickerOpen: boolean
  canTranscribe: boolean
  canOpenTxt: boolean
  onBrowsePathChange: (value: string) => void
  onPathSubmit: () => void
  onPathPickerOpenChange: (open: boolean) => void
  onUp: () => void
  onOpenSettings: () => void
  onClearPath: () => void
  onEntryClick: (entry: BrowserEntry) => void
  onTranscribe: () => void
  onOpenTxt: () => void
}

export function SetupView(props: SetupViewProps) {
  return (
    <div className={styles.setup}>
      <PathActionsRow
        locale={props.locale}
        browsePath={props.browsePath}
        recentFolders={props.recentFolders}
        loading={props.loading}
        pathPickerOpen={props.pathPickerOpen}
        onBrowsePathChange={props.onBrowsePathChange}
        onPathSubmit={props.onPathSubmit}
        onPathPickerOpenChange={props.onPathPickerOpenChange}
        onUp={props.onUp}
        onOpenSettings={props.onOpenSettings}
        onClearPath={props.onClearPath}
      />

      <p className={styles.mutedInfo}>{getTranscribeText(props.locale, 'helperBrowse')}</p>

      <BrowserList
        locale={props.locale}
        entries={props.entries}
        selectedAudioFiles={props.selectedAudioFiles}
        loading={props.loading}
        onEntryClick={props.onEntryClick}
      />

      <SelectionSummary locale={props.locale} selectedAudioText={props.selectedAudioText} />

      <SetupActions
        locale={props.locale}
        canTranscribe={props.canTranscribe}
        canOpenTxt={props.canOpenTxt}
        onTranscribe={props.onTranscribe}
        onOpenTxt={props.onOpenTxt}
      />
    </div>
  )
}

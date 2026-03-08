import { IconCircle } from '../../../../shared/ui/IconCircle'
import { getTranscribeText } from '../../i18n'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'
import { PathCombobox } from './PathCombobox'
import { CloseGlyph, SettingsGlyph, UpGlyph } from './TranscribeIcons'
import { ActionButton } from './ActionButton'

type PathActionsRowProps = {
  locale: DisplayLocale
  theme: 'day' | 'night'
  browsePath: string
  recentFolders: string[]
  loading: boolean
  pathPickerOpen: boolean
  onBrowsePathChange: (value: string) => void
  onPathSubmit: (value?: string) => void
  onPathPickerOpenChange: (open: boolean) => void
  onUp: () => void
  onOpenSettings: () => void
  onClearPath: () => void
}

export function PathActionsRow(props: PathActionsRowProps) {
  return (
    <div className={styles.pathRow}>
      <PathCombobox
        locale={props.locale}
        theme={props.theme}
        value={props.browsePath}
        options={props.recentFolders}
        loading={props.loading}
        open={props.pathPickerOpen}
        onChange={props.onBrowsePathChange}
        onSubmit={props.onPathSubmit}
        onOpenChange={props.onPathPickerOpenChange}
      />
      <ActionButton
        type="button"
        theme={props.theme}
        tone="secondary"
        icon={<UpGlyph />}
        onClick={props.onUp}
        disabled={props.loading}
      >
        {getTranscribeText(props.locale, 'buttonUp')}
      </ActionButton>
      <IconCircle type="button" theme={props.theme} title={getTranscribeText(props.locale, 'buttonSettings')} onClick={props.onOpenSettings} disabled={props.loading}>
        <SettingsGlyph />
      </IconCircle>
      <IconCircle type="button" theme={props.theme} title={getTranscribeText(props.locale, 'buttonClear')} onClick={props.onClearPath} disabled={props.loading}>
        <CloseGlyph />
      </IconCircle>
    </div>
  )
}

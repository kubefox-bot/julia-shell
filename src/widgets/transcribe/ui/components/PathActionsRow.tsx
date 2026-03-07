import { Button } from '../../../../shared/ui/Button'
import { IconButton } from '../../../../shared/ui/IconButton'
import { getTranscribeText } from '../../i18n'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'
import { PathCombobox } from './PathCombobox'

type PathActionsRowProps = {
  locale: DisplayLocale
  browsePath: string
  recentFolders: string[]
  loading: boolean
  pathPickerOpen: boolean
  onBrowsePathChange: (value: string) => void
  onPathSubmit: () => void
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
        value={props.browsePath}
        options={props.recentFolders}
        loading={props.loading}
        open={props.pathPickerOpen}
        onChange={props.onBrowsePathChange}
        onSubmit={props.onPathSubmit}
        onOpenChange={props.onPathPickerOpenChange}
      />
      <Button type="button" variant="secondary" onClick={props.onUp} disabled={props.loading}>
        {getTranscribeText(props.locale, 'buttonUp')}
      </Button>
      <IconButton type="button" title={getTranscribeText(props.locale, 'buttonSettings')} onClick={props.onOpenSettings} disabled={props.loading}>
        ⚙
      </IconButton>
      <IconButton type="button" title={getTranscribeText(props.locale, 'buttonClear')} onClick={props.onClearPath} disabled={props.loading}>
        ✕
      </IconButton>
    </div>
  )
}

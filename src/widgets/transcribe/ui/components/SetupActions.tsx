import { Button } from '../../../../shared/ui/Button'
import { getTranscribeText } from '../../i18n'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'

type SetupActionsProps = {
  locale: DisplayLocale
  canTranscribe: boolean
  canOpenTxt: boolean
  onTranscribe: () => void
  onOpenTxt: () => void
}

export function SetupActions(props: SetupActionsProps) {
  return (
    <div className={styles.mainActions}>
      {props.canTranscribe ? (
        <Button type="button" onClick={props.onTranscribe}>
          {getTranscribeText(props.locale, 'buttonTranscribe')}
        </Button>
      ) : null}
      {props.canOpenTxt ? (
        <Button type="button" variant="secondary" onClick={props.onOpenTxt}>
          {getTranscribeText(props.locale, 'buttonOpenTxt')}
        </Button>
      ) : null}
    </div>
  )
}

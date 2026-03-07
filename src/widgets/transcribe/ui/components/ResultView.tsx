import { Button } from '../../../../shared/ui/Button'
import { getTranscribeText } from '../../i18n'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'

type ResultViewProps = {
  locale: DisplayLocale
  resultText: string
  actionsLocked: boolean
  onBack: () => void
  onCopy: () => void
}

export function ResultView(props: ResultViewProps) {
  return (
    <div className={styles.resultBlock}>
      <textarea className={styles.resultText} readOnly value={props.resultText} />
      <div className={styles.resultActions}>
        <Button type="button" variant="secondary" onClick={props.onBack} disabled={props.actionsLocked}>
          {getTranscribeText(props.locale, 'buttonBack')}
        </Button>
        <Button type="button" onClick={props.onCopy} disabled={props.actionsLocked || !props.resultText}>
          {getTranscribeText(props.locale, 'buttonCopy')}
        </Button>
      </div>
    </div>
  )
}

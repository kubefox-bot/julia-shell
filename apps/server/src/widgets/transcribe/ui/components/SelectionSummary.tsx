import { getTranscribeText } from '../../i18n'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'

type SelectionSummaryProps = {
  locale: DisplayLocale
  selectedAudioText: string
}

export function SelectionSummary(props: SelectionSummaryProps) {
  return (
    <p className={styles.meta}>
      {getTranscribeText(props.locale, 'helperSelectedFiles')}: <span>{props.selectedAudioText}</span>
    </p>
  )
}

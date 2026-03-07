import { getTranscribeText } from '../../i18n'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'
import { ActionButton } from './ActionButton'
import { BackGlyph, CopyGlyph } from './TranscribeIcons'

type ResultViewProps = {
  locale: DisplayLocale
  theme: 'day' | 'night'
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
        <ActionButton type="button" theme={props.theme} tone="secondary" icon={<BackGlyph />} onClick={props.onBack} disabled={props.actionsLocked}>
          {getTranscribeText(props.locale, 'buttonBack')}
        </ActionButton>
        <ActionButton type="button" theme={props.theme} icon={<CopyGlyph />} onClick={props.onCopy} disabled={props.actionsLocked || !props.resultText}>
          {getTranscribeText(props.locale, 'buttonCopy')}
        </ActionButton>
      </div>
    </div>
  )
}

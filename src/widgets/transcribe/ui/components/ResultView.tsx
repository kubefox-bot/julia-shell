import { Button } from '../../../../shared/ui/Button'
import { getTranscribeText } from '../../i18n'
import { useTranscribeStore } from '../model/store'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'

type ResultViewProps = {
  locale: DisplayLocale
  onBack: () => void
  onReadAloud: () => void
  onCopy: () => void
  onSave: () => void
}

export function ResultView({ locale, onBack, onReadAloud, onCopy, onSave }: ResultViewProps) {
  const resultText = useTranscribeStore((state) => state.resultText)
  const actionsLocked = useTranscribeStore((state) => state.actionsLocked)

  return (
    <div className={styles.resultBlock}>
      <textarea className={styles.resultText} readOnly value={resultText} />
      <div className={styles.resultActions}>
        <Button type="button" variant="secondary" onClick={onBack} disabled={actionsLocked}>
          {getTranscribeText(locale, 'buttonBack')}
        </Button>
        <Button type="button" variant="secondary" onClick={onReadAloud} disabled={actionsLocked || !resultText}>
          {getTranscribeText(locale, 'buttonReadAloud')}
        </Button>
        <Button type="button" onClick={onCopy} disabled={actionsLocked || !resultText}>
          {getTranscribeText(locale, 'buttonCopy')}
        </Button>
        <Button type="button" variant="secondary" onClick={onSave} disabled={actionsLocked || !resultText}>
          {getTranscribeText(locale, 'buttonSave')}
        </Button>
      </div>
    </div>
  )
}

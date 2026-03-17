import { getTranscribeText } from '../../../i18n'
import styles from '../../TranscribeWidget.module.css'
import { CloseGlyph } from '../TranscribeIcons'
import { ResultTranscriptPanel } from './ResultTranscriptPanel'
import type { ResultViewProps } from './types'

type ResultFullscreenModalProps = Pick<ResultViewProps, 'locale' | 'theme'> & {
  visibleText: string
  actionsLocked: boolean
  isActionsDisabled: boolean
  onClose: () => void
}

export function ResultFullscreenModal(props: ResultFullscreenModalProps) {
  return (
    <div className={styles.resultFullscreenOverlay} role="dialog" aria-modal="true">
      <div className={[styles.resultFullscreenModal, props.theme === 'night' ? styles.resultFullscreenModalNight : ''].join(' ').trim()}>
        <div className={styles.resultFullscreenHeader}>
          <h4>{getTranscribeText(props.locale, 'titleResultFullscreen')}</h4>
          <button
            type="button"
            className={styles.resultFullscreenClose}
            onClick={props.onClose}
            disabled={props.isActionsDisabled}
            aria-label={getTranscribeText(props.locale, 'buttonCloseFullscreen')}
          >
            <CloseGlyph />
          </button>
        </div>
        <ResultTranscriptPanel
          text={props.visibleText}
          actionsLocked={props.actionsLocked}
          className={[styles.resultText, styles.resultTextFullscreen].join(' ')}
        />
      </div>
    </div>
  )
}

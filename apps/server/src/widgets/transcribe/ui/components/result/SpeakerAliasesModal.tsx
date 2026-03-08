import { getTranscribeText } from '../../../i18n'
import styles from '../../TranscribeWidget.module.scss'
import { ActionButton } from '../ActionButton'
import { BackGlyph, CloseGlyph, SaveGlyph } from '../TranscribeIcons'
import type { ResultViewProps, SpeakerTarget } from './types'

type SpeakerAliasesModalProps = Pick<ResultViewProps, 'locale' | 'theme' | 'isTranscribing' | 'speakerAliasesSaving'> & {
  speakerTargets: SpeakerTarget[]
  speakerDraft: Record<string, string>
  onSpeakerDraftChange: (speakerKey: string, value: string) => void
  onClose: () => void
  onSave: () => void
}

export function SpeakerAliasesModal(props: SpeakerAliasesModalProps) {
  return (
    <div className={styles.speakerModalOverlay} role="dialog" aria-modal="true">
      <div className={[styles.speakerModal, props.theme === 'night' ? styles.speakerModalNight : ''].join(' ').trim()}>
        <div className={styles.speakerModalHeader}>
          <h4>{getTranscribeText(props.locale, 'titleSpeakerAliases')}</h4>
          <button
            type="button"
            className={styles.speakerModalClose}
            onClick={props.onClose}
            disabled={props.speakerAliasesSaving || props.isTranscribing}
            aria-label={getTranscribeText(props.locale, 'buttonCloseSpeakerAliases')}
          >
            <CloseGlyph />
          </button>
        </div>
        {props.speakerTargets.length === 0 ? (
          <p className={styles.mutedInfo}>{getTranscribeText(props.locale, 'helperSpeakerAliasesEmpty')}</p>
        ) : (
          <div className={styles.speakerAliasList}>
            {props.speakerTargets.map((target) => (
              <div key={target.speakerKey} className={styles.speakerAliasRow}>
                <div className={styles.speakerAliasLabel}>
                  <span>{getTranscribeText(props.locale, 'labelSpeakerOriginal')}</span>
                  <strong>{target.speakerLabel}</strong>
                </div>
                <label className={styles.speakerAliasLabel}>
                  <span>{getTranscribeText(props.locale, 'labelSpeakerAlias')}</span>
                  <input
                    value={props.speakerDraft[target.speakerKey] ?? ''}
                    onChange={(event) => props.onSpeakerDraftChange(target.speakerKey, event.currentTarget.value)}
                    placeholder={getTranscribeText(props.locale, 'placeholderSpeakerAlias')}
                  />
                </label>
              </div>
            ))}
          </div>
        )}
        <div className={styles.resultActions}>
          <ActionButton type="button" theme={props.theme} tone="secondary" icon={<BackGlyph />} onClick={props.onClose} disabled={props.speakerAliasesSaving || props.isTranscribing}>
            {getTranscribeText(props.locale, 'buttonBack')}
          </ActionButton>
          <ActionButton
            type="button"
            theme={props.theme}
            icon={<SaveGlyph />}
            onClick={props.onSave}
            disabled={props.speakerAliasesSaving || props.isTranscribing || props.speakerTargets.length === 0}
          >
            {getTranscribeText(props.locale, 'buttonSaveSpeakerAliases')}
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

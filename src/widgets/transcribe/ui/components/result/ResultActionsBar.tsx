import { getTranscribeText } from '../../../i18n'
import styles from '../../TranscribeWidget.module.scss'
import { ActionButton } from '../ActionButton'
import { BackGlyph, CopyGlyph, ExpandGlyph, SaveGlyph, SettingsGlyph } from '../TranscribeIcons'
import type { ResultViewProps } from './types'

type ResultActionsBarProps = Pick<ResultViewProps, 'locale' | 'theme'> & {
  visibleText: string
  resultText: string
  isActionsDisabled: boolean
  onBack: () => void
  onOpenSpeakerAliases: () => void
  onExpand: () => void
  onCopy: () => void
  onSaveResult: (transcript: string) => void
}

export function ResultActionsBar(props: ResultActionsBarProps) {
  return (
    <div className={styles.resultActions}>
      <ActionButton type="button" theme={props.theme} tone="secondary" icon={<BackGlyph />} onClick={props.onBack} disabled={props.isActionsDisabled}>
        {getTranscribeText(props.locale, 'buttonBack')}
      </ActionButton>
      <ActionButton
        type="button"
        theme={props.theme}
        tone="secondary"
        icon={<SettingsGlyph />}
        onClick={props.onOpenSpeakerAliases}
        disabled={props.isActionsDisabled || !props.resultText}
      >
        {getTranscribeText(props.locale, 'buttonSpeakerAliases')}
      </ActionButton>
      <ActionButton
        type="button"
        theme={props.theme}
        tone="secondary"
        icon={<ExpandGlyph />}
        onClick={props.onExpand}
        disabled={props.isActionsDisabled || !props.resultText}
      >
        {getTranscribeText(props.locale, 'buttonExpandResult')}
      </ActionButton>
      <ActionButton type="button" theme={props.theme} icon={<CopyGlyph />} onClick={props.onCopy} disabled={props.isActionsDisabled || !props.resultText}>
        {getTranscribeText(props.locale, 'buttonCopy')}
      </ActionButton>
      <ActionButton
        type="button"
        theme={props.theme}
        icon={<SaveGlyph />}
        onClick={() => props.onSaveResult(props.visibleText)}
        disabled={props.isActionsDisabled || !props.resultText}
      >
        {getTranscribeText(props.locale, 'buttonSaveResult')}
      </ActionButton>
    </div>
  )
}

import { getTranscribeText } from '../../i18n'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'
import { ActionButton } from './ActionButton'
import { ReadGlyph, WaveGlyph } from './TranscribeIcons'

type SetupActionsProps = {
  locale: DisplayLocale
  theme: 'day' | 'night'
  canTranscribe: boolean
  canOpenTxt: boolean
  onTranscribe: () => void
  onOpenTxt: () => void
}

export function SetupActions(props: SetupActionsProps) {
  return (
    <div className={styles.mainActions}>
      {props.canTranscribe ? (
        <ActionButton type="button" theme={props.theme} icon={<WaveGlyph />} onClick={props.onTranscribe}>
          {getTranscribeText(props.locale, 'buttonTranscribe')}
        </ActionButton>
      ) : null}
      {props.canOpenTxt ? (
        <ActionButton type="button" theme={props.theme} tone="secondary" icon={<ReadGlyph />} onClick={props.onOpenTxt}>
          {getTranscribeText(props.locale, 'buttonOpenTxt')}
        </ActionButton>
      ) : null}
    </div>
  )
}

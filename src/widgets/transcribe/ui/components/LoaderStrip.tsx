import { getTranscribeText, isTranscribeTextKey } from '../../i18n'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'

type LoaderStripProps = {
  locale: DisplayLocale
  visible: boolean
  progress: number
  progressStage: string
}

export function LoaderStrip(props: LoaderStripProps) {
  if (!props.visible) {
    return null
  }

  const stageText = props.progressStage && isTranscribeTextKey(props.progressStage)
    ? getTranscribeText(props.locale, props.progressStage)
    : getTranscribeText(props.locale, 'statusTranscribing')

  return (
    <div className={styles.loaderStrip}>
      <div className={styles.loaderStripHeader}>
        <strong>{getTranscribeText(props.locale, 'statusTranscribing')}</strong>
        <span>{Math.max(0, Math.min(100, props.progress))}%</span>
      </div>
      <div className={styles.loaderStripTrack}>
        <div className={styles.loaderStripFill} style={{ width: `${Math.max(0, Math.min(100, props.progress))}%` }} />
      </div>
      <p className={styles.loaderStripStage}>{stageText}</p>
    </div>
  )
}

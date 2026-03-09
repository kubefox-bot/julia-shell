import { getTranscribeText, isTranscribeTextKey } from '../../i18n'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'
import { useTranscribeStore } from '../model/store'

const MAX_PROGRESS_PERCENT = 100

type LoaderStripProps = {
  locale: DisplayLocale
  visible: boolean
  progress: number
  progressStage: string
}

export function LoaderStrip(props: LoaderStripProps) {
  const status = useTranscribeStore((state) => state.status)

  if (!props.visible) {
    return null
  }

  const normalizedProgress = Math.max(0, Math.min(MAX_PROGRESS_PERCENT, props.progress))
  const stageText = isTranscribeTextKey(props.progressStage)
    ? getTranscribeText(props.locale, props.progressStage)
    : ''
  const statusText = getTranscribeText(props.locale, status.key, status.vars)

  return (
    <div className={styles.loaderStrip}>
      <div className={styles.loaderStripHeader}>
        <strong>{stageText ?? statusText}</strong>
        <span>{normalizedProgress}%</span>
      </div>
      <div className={styles.loaderStripTrack}>
        <div className={styles.loaderStripFill} style={{ width: `${normalizedProgress}%` }} />
      </div>
    </div>
  )
}

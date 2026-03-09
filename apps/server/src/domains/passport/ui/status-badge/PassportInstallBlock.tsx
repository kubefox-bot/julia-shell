import { Button } from '@shared/ui/Button'
import styles from '../PassportStatusBadge.module.scss'
import type { AgentPlatform } from './types'

type PassportInstallBlockProps = {
  platform: AgentPlatform
  setPlatform: (platform: AgentPlatform) => void
  downloadUrl: string
  labels: {
    title: string
    windows: string
    macos: string
    linux: string
    download: string
  }
}

export function PassportInstallBlock({
  platform,
  setPlatform,
  downloadUrl,
  labels,
}: PassportInstallBlockProps) {
  return (
    <div className={styles.agentInstallBlock}>
      <span className={styles.agentInstallTitle}>{labels.title}</span>
      <div className={styles.agentInstallOsTabs}>
        <Button
          type="button"
          variant={platform === 'windows' ? 'secondary' : 'ghost'}
          className={platform === 'windows' ? styles.agentOsTabActive : styles.agentOsTab}
          onClick={() => setPlatform('windows')}
        >
          {labels.windows}
        </Button>
        <Button
          type="button"
          variant={platform === 'macos' ? 'secondary' : 'ghost'}
          className={platform === 'macos' ? styles.agentOsTabActive : styles.agentOsTab}
          onClick={() => setPlatform('macos')}
        >
          {labels.macos}
        </Button>
        <Button
          type="button"
          variant={platform === 'linux' ? 'secondary' : 'ghost'}
          className={platform === 'linux' ? styles.agentOsTabActive : styles.agentOsTab}
          onClick={() => setPlatform('linux')}
        >
          {labels.linux}
        </Button>
      </div>
      <a
        className={styles.agentInstallDownload}
        href={downloadUrl}
        target="_blank"
        rel="noreferrer"
      >
        {labels.download}
      </a>
    </div>
  )
}

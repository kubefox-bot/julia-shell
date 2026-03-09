import { useEffect, useMemo, useState } from 'react'
import { useShellI18n } from '@app/shell/model/selectors'
import { useShellStore } from '@app/shell/model/store'
import { Button } from '@/shared/ui/Button'
import type { PassportAuthStatus } from '../client/types'
import styles from './PassportStatusBadge.module.scss'
import { resolveAgentReleasesBaseUrl } from './status-badge/env'
import { getAgentDownloadUrl } from './status-badge/get-agent-download-url'
import { getDefaultPlatform } from './status-badge/get-default-platform'
import { getLampClass } from './status-badge/get-lamp-class'
import { getStatusCopyKey } from './status-badge/get-status-copy-key'
import { PassportInstallBlock } from './status-badge/PassportInstallBlock'
import type { AgentPlatform } from './status-badge/types'

const AGENT_RELEASES_BASE_URL = resolveAgentReleasesBaseUrl()

export function PassportStatusBadge() {
  const { t } = useShellI18n()
  const passportStatus = useShellStore((state) => state.passportStatus)
  const isLoading = useShellStore((state) => state.passportLoading)
  const isActionPending = useShellStore((state) => state.passportBusy)
  const syncFromStatus = useShellStore((state) => state.syncFromStatus)
  const retryStatus = useShellStore((state) => state.retryStatus)
  const [platform, setPlatform] = useState<AgentPlatform>('windows')

  const currentStatus: PassportAuthStatus = passportStatus?.status ?? 'disconnected'
  const isConnected = currentStatus === 'connected' || currentStatus === 'connected_dev'
  const isDisconnected = currentStatus === 'disconnected'
  const actionLabel = isConnected ? t('agentStatusRefresh') : t('agentStatusConnect')
  const hostname = passportStatus?.hostname?.trim() || ''
  const downloadUrl = getAgentDownloadUrl(AGENT_RELEASES_BASE_URL, platform)
  const installLabels = useMemo(
    () => ({
      title: t('agentInstallTitle'),
      windows: t('agentInstallOsWindows'),
      macos: t('agentInstallOsMacos'),
      linux: t('agentInstallOsLinux'),
      download: t('agentInstallDownload'),
    }),
    [t]
  )

  const statusLabel = useMemo(() => t(getStatusCopyKey(currentStatus)), [currentStatus, t])

  useEffect(() => {
    setPlatform(getDefaultPlatform())
  }, [])

  return (
    <div className={styles.agentStatusBadge}>
      <div className={styles.agentStatusRow}>
        <span className={`${styles.agentLamp} ${getLampClass(currentStatus)}`} aria-hidden="true" />
        <span className={styles.agentStatusText}>{statusLabel}</span>
        <Button
          type="button"
          variant="ghost"
          className={styles.agentStatusAction}
          onClick={() => void (isConnected ? syncFromStatus() : retryStatus())}
          disabled={isLoading || isActionPending}
        >
          {actionLabel}
        </Button>
      </div>
      {hostname ? (
        <div className={styles.agentMetaRow}>
          <span className={styles.agentHostname}>{hostname}</span>
        </div>
      ) : null}
      {isDisconnected ? (
        <PassportInstallBlock
          platform={platform}
          setPlatform={setPlatform}
          downloadUrl={downloadUrl}
          labels={installLabels}
        />
      ) : null}
    </div>
  )
}

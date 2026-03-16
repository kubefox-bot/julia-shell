import { useEffect, useMemo, useState } from 'react'
import { useShellI18n } from '../../../app/shell/model/selectors'
import { useShellStore } from '../../../app/shell/model/store'
import { Button } from '@shared/ui/Button'
import type { PassportAuthStatus, PassportOnlineAgent } from '../client/types'
import styles from './PassportStatusBadge.module.scss'
import { resolveAgentReleasesBaseUrl } from './status-badge/env'
import { getAgentDownloadUrl } from './status-badge/get-agent-download-url'
import { getDefaultPlatform } from './status-badge/get-default-platform'
import { getLampClassKey } from './status-badge/get-lamp-class'
import { getStatusCopyKey } from './status-badge/get-status-copy-key'
import { resolvePassportTrafficLightState } from './status-badge/resolve-traffic-light-state'
import { PassportInstallBlock } from './status-badge/PassportInstallBlock'
import type { AgentPlatform } from './status-badge/types'

const AGENT_RELEASES_BASE_URL = resolveAgentReleasesBaseUrl()

function getAgentPrimaryLabel(agent: PassportOnlineAgent) {
  return agent.displayName?.trim() || agent.hostname?.trim() || agent.agentId
}

function getAgentMetaLabel(agent: PassportOnlineAgent) {
  const displayName = agent.displayName?.trim() || ''
  const hostname = agent.hostname?.trim() || ''

  if (displayName && hostname && displayName !== hostname) {
    return hostname
  }

  if (displayName && displayName !== agent.agentId) {
    return agent.agentId
  }

  return hostname || agent.agentId
}

export function PassportStatusBadge() {
  const { t } = useShellI18n()
  const passportStatus = useShellStore((state) => state.passportStatus)
  const passportAgents = useShellStore((state) => state.passportAgents)
  const isLoading = useShellStore((state) => state.passportLoading)
  const isActionPending = useShellStore((state) => state.passportBusy)
  const connectAgent = useShellStore((state) => state.connectAgent)
  const retryStatus = useShellStore((state) => state.retryStatus)
  const [platform, setPlatform] = useState<AgentPlatform>('windows')

  const trafficLightState = useShellStore((state) =>
    resolvePassportTrafficLightState({
      status: (state.passportStatus?.status ?? 'disconnected') as PassportAuthStatus,
      onlineAgentsCount: state.passportAgents.length,
    })
  )
  const statusCopyKey = useShellStore((state) => {
    const status = (state.passportStatus?.status ?? 'disconnected') as PassportAuthStatus
    const nextTrafficLightState = resolvePassportTrafficLightState({
      status,
      onlineAgentsCount: state.passportAgents.length,
    })

    return getStatusCopyKey({
      status,
      trafficLightState: nextTrafficLightState,
    })
  })
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

  const statusLabel = t(statusCopyKey)

  useEffect(() => {
    setPlatform(getDefaultPlatform())
  }, [])

  return (
    <div className={styles.agentStatusBadge}>
      <div className={styles.agentStatusRow}>
        <span className={`${styles.agentLamp} ${styles[getLampClassKey(trafficLightState)]}`} aria-hidden="true" />
        <span className={styles.agentStatusText}>{statusLabel}</span>
        <Button
          type="button"
          variant="ghost"
          className={styles.agentStatusAction}
          onClick={() => void retryStatus()}
          disabled={isLoading || isActionPending}
        >
          {t('agentStatusRefresh')}
        </Button>
      </div>
      {hostname ? (
        <div className={styles.agentMetaRow}>
          <span className={styles.agentHostname}>{hostname}</span>
        </div>
      ) : null}
      {passportAgents.length > 0 ? (
        <div className={styles.agentListBlock}>
          <div className={styles.agentListTitle}>{t('agentStatusAvailableAgents')}</div>
          <div className={styles.agentList}>
            {passportAgents.map((agent) => (
              <div key={agent.agentId} className={styles.agentListRow}>
                <div className={styles.agentListText}>
                  <div className={styles.agentListPrimary}>
                    <span className={`${styles.agentLamp} ${styles.agentLampGreen}`} aria-hidden="true" />
                    <span className={styles.agentListName}>{getAgentPrimaryLabel(agent)}</span>
                    {agent.isCurrent ? (
                      <span className={styles.agentCurrentBadge}>{t('agentStatusCurrentAgent')}</span>
                    ) : null}
                  </div>
                  <div className={styles.agentListMeta}>{getAgentMetaLabel(agent)}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className={styles.agentConnectAction}
                  onClick={() => void connectAgent(agent.agentId)}
                  disabled={agent.isCurrent || isLoading || isActionPending}
                >
                  {agent.isCurrent ? t('agentStatusConnected') : t('agentStatusConnect')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {trafficLightState === 'red' ? (
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

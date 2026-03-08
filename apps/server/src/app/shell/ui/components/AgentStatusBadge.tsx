import { useEffect, useMemo, useState } from 'react';
import type { AgentUiStatus } from '../../../agent-service/model/types';
import { useShellI18n } from '../../model/selectors';
import { useShellStore } from '../../model/store';
import styles from '../ShellApp.module.scss';

function getStatusCopyKey(status: AgentUiStatus) {
  if (status === 'connected') return 'agentStatusConnected';
  if (status === 'connected_dev') return 'agentStatusConnectedDev';
  if (status === 'unauthorized') return 'agentStatusUnauthorized';
  return 'agentStatusDisconnected';
}

function getLampClass(status: AgentUiStatus) {
  if (status === 'connected' || status === 'connected_dev') return styles.agentLampGreen;
  if (status === 'unauthorized') return styles.agentLampYellow;
  return styles.agentLampRed;
}

type AgentPlatform = 'windows' | 'macos' | 'linux';

const AGENT_RELEASES_BASE_URL =
  import.meta.env.PUBLIC_AGENT_RELEASES_BASE_URL ?? 'https://github.com/kubefox-bot/julia-shell/releases/latest/download';

const AGENT_ASSET_BY_PLATFORM: Record<AgentPlatform, string> = {
  windows: 'julia-agent-windows-x64.zip',
  macos: 'julia-agent-macos-arm64.tar.gz',
  linux: 'julia-agent-linux-x64.tar.gz'
};

function getDefaultPlatform(): AgentPlatform {
  if (typeof window === 'undefined') return 'windows';
  const source = window.navigator.userAgent.toLowerCase();
  if (source.includes('mac')) return 'macos';
  if (source.includes('linux')) return 'linux';
  return 'windows';
}

export function AgentStatusBadge() {
  const { t } = useShellI18n();
  const agentStatus = useShellStore((state) => state.agentStatus);
  const isLoading = useShellStore((state) => state.agentStatusLoading);
  const isActionPending = useShellStore((state) => state.agentStatusBusy);
  const loadAgentStatus = useShellStore((state) => state.loadAgentStatus);
  const retryAgentConnection = useShellStore((state) => state.retryAgentConnection);
  const [platform, setPlatform] = useState<AgentPlatform>('windows');

  const currentStatus: AgentUiStatus = agentStatus?.status ?? 'disconnected';
  const isConnected = currentStatus === 'connected' || currentStatus === 'connected_dev';
  const isDisconnected = currentStatus === 'disconnected';
  const actionLabel = isConnected ? t('agentStatusRefresh') : t('agentStatusConnect');
  const hostname = agentStatus?.hostname?.trim() || '';
  const assetName = AGENT_ASSET_BY_PLATFORM[platform];
  const downloadUrl = `${AGENT_RELEASES_BASE_URL}/${assetName}`;

  const statusLabel = useMemo(() => t(getStatusCopyKey(currentStatus)), [currentStatus, t]);

  useEffect(() => {
    setPlatform(getDefaultPlatform());
  }, []);

  return (
    <div className={styles.agentStatusBadge}>
      <span className={`${styles.agentLamp} ${getLampClass(currentStatus)}`} aria-hidden="true" />
      <span className={styles.agentStatusText}>{statusLabel}</span>
      <button
        type="button"
        className={styles.agentStatusAction}
        onClick={() => void (isConnected ? loadAgentStatus() : retryAgentConnection())}
        disabled={isLoading || isActionPending}
      >
        {actionLabel}
      </button>
      {hostname ? <span className={styles.agentHostname}>{hostname}</span> : null}
      {isDisconnected ? (
        <div className={styles.agentInstallBlock}>
          <span className={styles.agentInstallTitle}>{t('agentInstallTitle')}</span>
          <div className={styles.agentInstallOsTabs}>
            <button type="button" className={platform === 'windows' ? styles.agentOsTabActive : styles.agentOsTab} onClick={() => setPlatform('windows')}>
              {t('agentInstallOsWindows')}
            </button>
            <button type="button" className={platform === 'macos' ? styles.agentOsTabActive : styles.agentOsTab} onClick={() => setPlatform('macos')}>
              {t('agentInstallOsMacos')}
            </button>
            <button type="button" className={platform === 'linux' ? styles.agentOsTabActive : styles.agentOsTab} onClick={() => setPlatform('linux')}>
              {t('agentInstallOsLinux')}
            </button>
          </div>
          <a className={styles.agentInstallDownload} href={downloadUrl} target="_blank" rel="noreferrer">
            {t('agentInstallDownload')}
          </a>
        </div>
      ) : null}
    </div>
  );
}

import { useMemo } from 'react';
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

export function AgentStatusBadge() {
  const { t } = useShellI18n();
  const agentStatus = useShellStore((state) => state.agentStatus);
  const isLoading = useShellStore((state) => state.agentStatusLoading);
  const isActionPending = useShellStore((state) => state.agentStatusBusy);
  const loadAgentStatus = useShellStore((state) => state.loadAgentStatus);
  const retryAgentConnection = useShellStore((state) => state.retryAgentConnection);

  const currentStatus: AgentUiStatus = agentStatus?.status ?? 'disconnected';
  const isConnected = currentStatus === 'connected' || currentStatus === 'connected_dev';
  const actionLabel = isConnected ? t('agentStatusRefresh') : t('agentStatusConnect');

  const statusLabel = useMemo(() => t(getStatusCopyKey(currentStatus)), [currentStatus, t]);

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
    </div>
  );
}

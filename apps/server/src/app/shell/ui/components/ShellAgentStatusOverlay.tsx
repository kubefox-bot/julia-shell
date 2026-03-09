import { IconButton } from '../../../../shared/ui/IconButton';
import { useShellI18n } from '../../model/selectors';
import { PassportStatusBadge } from '@passport/ui';
import styles from '../ShellApp.module.scss';

type ShellAgentStatusOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function ShellAgentStatusOverlay({ open, onClose }: ShellAgentStatusOverlayProps) {
  const { t } = useShellI18n();

  if (!open) {
    return null;
  }

  return (
    <div className={styles.agentOverlay} role="dialog" aria-modal="true" aria-label={t('agentStatusDialogTitle')}>
      <button type="button" className={styles.agentScrim} onClick={onClose} aria-label={t('closeAgentStatus')} />
      <section className={styles.agentPanel}>
        <div className={styles.agentPanelHead}>
          <h2>{t('agentStatusDialogTitle')}</h2>
          <IconButton type="button" onClick={onClose} title={t('closeAgentStatus')}>
            ✕
          </IconButton>
        </div>
        <PassportStatusBadge />
      </section>
    </div>
  );
}

import { useState } from 'react';
import { Button } from '../../../../shared/ui/Button';
import { IconButton } from '../../../../shared/ui/IconButton';
import { useShellI18n, useShellLayoutViewModel, useShellLocale } from '../../model/selectors';
import { useShellStore } from '../../model/store';
import { ShellAgentStatusOverlay } from './ShellAgentStatusOverlay';
import styles from '../ShellApp.module.scss';

export function ShellHeaderActions() {
  const { t } = useShellI18n();
  const activeLocale = useShellLocale();
  const { hasUnsavedChanges } = useShellLayoutViewModel();
  const isEditMode = useShellStore((state) => state.isEditMode);
  const isSaving = useShellStore((state) => state.isSaving);
  const openSettings = useShellStore((state) => state.openSettings);
  const startEdit = useShellStore((state) => state.startEdit);
  const cancelEdit = useShellStore((state) => state.cancelEdit);
  const saveLayout = useShellStore((state) => state.saveLayout);
  const toggleTheme = useShellStore((state) => state.toggleTheme);
  const toggleLocale = useShellStore((state) => state.toggleLocale);
  const theme = useShellStore((state) => state.layoutSettings.theme);
  const passportStatus = useShellStore((state) => state.passportStatus);
  const [isAgentOverlayOpen, setIsAgentOverlayOpen] = useState(false);

  const themeToggleTitle =
    theme === 'auto' ? t('switchToDay') : theme === 'day' ? t('switchToNight') : t('switchToAutoTheme');
  const localeToggleTitle = activeLocale === 'ru' ? t('switchToEnglish') : t('switchToRussian');
  const agentStatus = passportStatus?.status ?? 'disconnected';
  const agentLampClass =
    agentStatus === 'connected' || agentStatus === 'connected_dev'
      ? styles.agentLampGreen
      : agentStatus === 'unauthorized'
        ? styles.agentLampYellow
        : styles.agentLampRed;

  return (
    <>
      <div className={styles.headerAside}>
        <div className={styles.headerMetaZone}>
          <div className={styles.headerMetaItem}>
            <div className={styles.headerActionsPanel}>
              <div className={styles.headerActions}>
                <IconButton type="button" onClick={() => setIsAgentOverlayOpen(true)} title={t('openAgentStatus')}>
                  <span className={`${styles.agentLamp} ${styles.agentActionLamp} ${agentLampClass}`} aria-hidden="true" />
                </IconButton>
                <IconButton type="button" onClick={openSettings} title={t('settings')}>
                  ⚙️
                </IconButton>
                <IconButton type="button" onClick={() => void toggleLocale()} title={localeToggleTitle}>
                  {activeLocale === 'ru' ? '🇷🇺' : '🇺🇸'}
                </IconButton>
                <IconButton type="button" onClick={() => void toggleTheme()} title={themeToggleTitle}>
                  {theme === 'auto' ? '🕒' : theme === 'day' ? '🌙' : '☀️'}
                </IconButton>
                {!isEditMode ? (
                  <IconButton type="button" onClick={startEdit} title={t('editGrid')}>
                    ✎
                  </IconButton>
                ) : (
                  <>
                    <Button type="button" variant="secondary" onClick={cancelEdit} disabled={isSaving}>
                      {t('cancel')}
                    </Button>
                    <Button type="button" onClick={() => void saveLayout()} disabled={isSaving || !hasUnsavedChanges}>
                      {isSaving ? t('saving') : t('save')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ShellAgentStatusOverlay open={isAgentOverlayOpen} onClose={() => setIsAgentOverlayOpen(false)} />
    </>
  );
}

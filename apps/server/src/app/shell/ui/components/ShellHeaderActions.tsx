import { useEffect, useState } from 'react';
import { Button } from '../../../../shared/ui/Button';
import { IconButton } from '../../../../shared/ui/IconButton';
import type { DisplayLocale } from '../../../../entities/widget/model/types';
import { getShellText } from '../../lib/i18n';
import { useShellLayoutViewModel } from '../../model/selectors';
import { useShellStore } from '../../model/store';
import { ShellAgentStatusOverlay } from './ShellAgentStatusOverlay';
import styles from '../ShellApp.module.scss';
import { resolveDisplayLocale } from '../../../../shared/lib/locale';

type ShellHeaderActionsProps = {
  initialLocale: DisplayLocale;
};

export function ShellHeaderActions({ initialLocale }: ShellHeaderActionsProps) {
  const [activeLocale, setActiveLocale] = useState<DisplayLocale>(initialLocale);
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

  useEffect(() => {
    const unsubscribe = useShellStore.subscribe((nextState, prevState) => {
      const nextLocale = resolveDisplayLocale(nextState.layoutSettings.locale);
      const prevLocale = resolveDisplayLocale(prevState.layoutSettings.locale);
      if (nextLocale !== prevLocale) {
        setActiveLocale(nextLocale);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const themeToggleTitle =
    theme === 'auto'
      ? getShellText(activeLocale, 'switchToDay')
      : theme === 'day'
        ? getShellText(activeLocale, 'switchToNight')
        : getShellText(activeLocale, 'switchToAutoTheme');
  const localeToggleTitle =
    activeLocale === 'ru'
      ? getShellText(activeLocale, 'switchToEnglish')
      : getShellText(activeLocale, 'switchToRussian');
  const agentStatus = passportStatus?.status ?? 'disconnected';
  const agentLampClass =
    agentStatus === 'connected' || agentStatus === 'connected_dev'
      ? styles.agentLampGreen
      : agentStatus === 'unauthorized'
        ? styles.agentLampYellow
        : styles.agentLampRed;

  return (
    <>
      <div id="shell-header-actions" className={styles.headerAside}>
        <div className={styles.headerMetaZone}>
          <div className={styles.headerMetaItem}>
            <div className={styles.headerActionsPanel}>
              <div className={styles.headerActions}>
                <IconButton
                  type="button"
                  onClick={() => setIsAgentOverlayOpen(true)}
                  title={getShellText(activeLocale, 'openAgentStatus')}
                >
                  <span className={`${styles.agentLamp} ${styles.agentActionLamp} ${agentLampClass}`} aria-hidden="true" />
                </IconButton>
                <IconButton type="button" onClick={openSettings} title={getShellText(activeLocale, 'settings')}>
                  ⚙️
                </IconButton>
                <IconButton type="button" onClick={() => void toggleLocale()} title={localeToggleTitle}>
                  {activeLocale === 'ru' ? '🇷🇺' : '🇺🇸'}
                </IconButton>
                <IconButton type="button" onClick={() => void toggleTheme()} title={themeToggleTitle}>
                  {theme === 'auto' ? '🕒' : theme === 'day' ? '🌙' : '☀️'}
                </IconButton>
                {!isEditMode ? (
                  <IconButton type="button" onClick={startEdit} title={getShellText(activeLocale, 'editGrid')}>
                    ✎
                  </IconButton>
                ) : (
                  <>
                    <Button type="button" variant="secondary" onClick={cancelEdit} disabled={isSaving}>
                      {getShellText(activeLocale, 'cancel')}
                    </Button>
                    <Button type="button" onClick={() => void saveLayout()} disabled={isSaving || !hasUnsavedChanges}>
                      {isSaving ? getShellText(activeLocale, 'saving') : getShellText(activeLocale, 'save')}
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

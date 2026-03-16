import { useEffect, useState } from 'react';
import { Button } from '@shared/ui/Button';
import { IconButton } from '@shared/ui/IconButton';
import type { DisplayLocale } from '@/entities/widget/model/types';
import { getShellText } from '@app/shell/lib/i18n';
import { useShellLayoutViewModel } from '@app/shell/model/selectors';
import { useShellStore } from '@app/shell/model/store';
import type { ShellStore } from '@app/shell/model/types';
import { ShellAgentStatusOverlay } from '@app/shell/ui/components/shell-agent-status-overlay';
import styles from '@app/shell/ui/shell-app/ShellApp.module.scss';
import { resolveDisplayLocale } from '@shared/lib/locale';

type ShellHeaderActionsProps = {
  initialLocale: DisplayLocale;
};

function resolveThemeToggleTitle(theme: 'auto' | 'day' | 'night', locale: DisplayLocale) {
  if (theme === 'auto') {
    return getShellText(locale, 'switchToDay');
  }

  if (theme === 'day') {
    return getShellText(locale, 'switchToNight');
  }

  return getShellText(locale, 'switchToAutoTheme');
}

function resolveLocaleToggleTitle(locale: DisplayLocale) {
  const targetKey = locale === 'ru' ? 'switchToEnglish' : 'switchToRussian';
  return getShellText(locale, targetKey);
}

function resolveAgentLampClass(
  status: string,
  styles: Record<string, string>
) {
  if (status === 'connected' || status === 'connected_dev') {
    return styles.agentLampGreen;
  }

  if (status === 'unauthorized') {
    return styles.agentLampYellow;
  }

  return styles.agentLampRed;
}

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
    const unsubscribe = useShellStore.subscribe((nextState: ShellStore, prevState: ShellStore) => {
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

  const themeToggleTitle = resolveThemeToggleTitle(theme, activeLocale);
  const localeToggleTitle = resolveLocaleToggleTitle(activeLocale);
  const agentStatus = passportStatus?.status ?? 'disconnected';
  const agentLampClass = resolveAgentLampClass(agentStatus, styles);

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
                  {{ auto: '🕒', day: '🌙', night: '☀️' }[theme]}
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

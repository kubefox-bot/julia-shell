import { Button } from '../../../../shared/ui/Button';
import { IconButton } from '../../../../shared/ui/IconButton';
import { useShellClockViewModel, useShellI18n, useShellLayoutViewModel, useShellLocale } from '../../model/selectors';
import { useShellStore } from '../../model/store';
import { AgentStatusBadge } from './AgentStatusBadge';
import styles from '../ShellApp.module.scss';

export function ShellHeader() {
  const { formattedDate, formattedTime, quote, greeting } = useShellClockViewModel();
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

  const themeToggleTitle =
    theme === 'auto' ? t('switchToDay') : theme === 'day' ? t('switchToNight') : t('switchToAutoTheme');
  const localeToggleTitle = activeLocale === 'ru' ? t('switchToEnglish') : t('switchToRussian');

  return (
    <header className={styles.header}>
      <div className={styles.headerIntro}>
        <p className={styles.headerEyebrow}>{quote}</p>
        <h1>{greeting}</h1>
      </div>
      <div className={styles.headerAside}>
        <AgentStatusBadge />
        <div className={styles.headerClock}>
          <span className={styles.headerTime} suppressHydrationWarning>{formattedTime}</span>
          <span className={styles.headerDate} suppressHydrationWarning>{formattedDate}</span>
        </div>
        <div className={styles.headerActions}>
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
    </header>
  );
}

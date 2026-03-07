import { useEffect } from 'react';
import { useShellLoadingState } from '../model/selectors';
import { useShellStore } from '../model/store';
import { ShellHeader } from './components/ShellHeader';
import { ShellSettingsOverlay } from './components/ShellSettingsOverlay';
import { WidgetGrid } from './components/WidgetGrid';
import styles from './ShellApp.module.scss';

export function ShellApp() {
  const { loading, error } = useShellLoadingState();
  const loadShell = useShellStore((state) => state.loadShell);
  const setBrowserLocale = useShellStore((state) => state.setBrowserLocale);

  useEffect(() => {
    void loadShell();

    if (typeof navigator !== 'undefined') {
      setBrowserLocale(navigator.language);
    }
  }, [loadShell, setBrowserLocale]);

  if (loading) {
    return <div className={styles.loading}>Загрузка shell...</div>;
  }

  return (
    <div className={styles.shellRoot}>
      <ShellHeader />
      {error ? <p className={styles.error}>Ошибка: {error}</p> : null}
      <ShellSettingsOverlay />
      <WidgetGrid />
    </div>
  );
}

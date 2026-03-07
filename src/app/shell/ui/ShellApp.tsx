import { useEffect } from 'react';
import { useResolvedShellTheme, useShellI18n, useShellLoadingState } from '../model/selectors';
import { CLOCK_TICK_INTERVAL_MS } from '../model/constants';
import { useShellStore } from '../model/store';
import { ShellHeader } from './components/ShellHeader';
import { ShellSettingsOverlay } from './components/ShellSettingsOverlay';
import { WidgetGrid } from './components/WidgetGrid';
import styles from './ShellApp.module.scss';

export function ShellApp() {
  const { loading, error } = useShellLoadingState();
  const { t } = useShellI18n();
  const theme = useResolvedShellTheme();
  const loadShell = useShellStore((state) => state.loadShell);
  const setBrowserLocale = useShellStore((state) => state.setBrowserLocale);
  const tickNow = useShellStore((state) => state.tickNow);

  useEffect(() => {
    void loadShell();

    if (typeof navigator !== 'undefined') {
      setBrowserLocale(navigator.language);
    }
  }, [loadShell, setBrowserLocale]);

  useEffect(() => {
    tickNow();

    const controller = new AbortController();
    const intervalId = window.setInterval(() => {
      tickNow();
    }, CLOCK_TICK_INTERVAL_MS);

    controller.signal.addEventListener(
      'abort',
      () => {
        window.clearInterval(intervalId);
      },
      { once: true }
    );

    return () => {
      controller.abort();
    };
  }, [tickNow]);

  useEffect(() => {
    document.documentElement.dataset.shellTheme = theme;
    document.body.dataset.shellTheme = theme;

    return () => {
      delete document.documentElement.dataset.shellTheme;
      delete document.body.dataset.shellTheme;
    };
  }, [theme]);

  if (loading) {
    return <div className={styles.loading}>{t('loading')}</div>;
  }

  return (
    <div className={styles.shellRoot} data-theme={theme}>
      <ShellHeader />
      {error ? <p className={styles.error}>{t('error')}: {error}</p> : null}
      <ShellSettingsOverlay />
      <WidgetGrid />
    </div>
  );
}

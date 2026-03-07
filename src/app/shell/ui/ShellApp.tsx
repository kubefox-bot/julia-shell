import { useEffect, useRef, useState } from 'react';
import { useResolvedShellTheme, useShellI18n, useShellLoadingState } from '../model/selectors';
import { CLOCK_TICK_INTERVAL_MS } from '../model/constants';
import { useShellStore } from '../model/store';
import type { ShellSettingsResponse } from '../model/types';
import { ShellBootSkeleton } from './components/ShellBootSkeleton';
import { ShellHeader } from './components/ShellHeader';
import { ShellSettingsOverlay } from './components/ShellSettingsOverlay';
import { WidgetGrid } from './components/WidgetGrid';
import styles from './ShellApp.module.scss';

type ShellAppProps = {
  initialShellSettings?: ShellSettingsResponse;
  initialNowIso?: string;
};

export function ShellApp({ initialShellSettings, initialNowIso }: ShellAppProps) {
  const hasSeededClockRef = useRef(false);

  if (!hasSeededClockRef.current && initialNowIso) {
    useShellStore.setState({ nowIso: initialNowIso });
    hasSeededClockRef.current = true;
  }

  const { loading, error } = useShellLoadingState();
  const { t } = useShellI18n();
  const theme = useResolvedShellTheme();
  const hydrateShell = useShellStore((state) => state.hydrateShell);
  const loadShell = useShellStore((state) => state.loadShell);
  const setBrowserLocale = useShellStore((state) => state.setBrowserLocale);
  const tickNow = useShellStore((state) => state.tickNow);
  const [isBootDelayComplete, setIsBootDelayComplete] = useState(false);

  useEffect(() => {
    if (initialShellSettings) {
      hydrateShell(initialShellSettings);
    } else {
      void loadShell();
    }

    if (typeof navigator !== 'undefined') {
      setBrowserLocale(navigator.language);
    }
  }, [hydrateShell, initialShellSettings, loadShell, setBrowserLocale]);

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
    const timeoutId = window.setTimeout(() => {
      setIsBootDelayComplete(true);
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.shellTheme = theme;
    document.body.dataset.shellTheme = theme;

    return () => {
      delete document.documentElement.dataset.shellTheme;
      delete document.body.dataset.shellTheme;
    };
  }, [theme]);

  useEffect(() => {
    if (!initialShellSettings || !isBootDelayComplete) {
      return;
    }

    window.dispatchEvent(new CustomEvent('yulia-shell-hydrated'));
  }, [initialShellSettings, isBootDelayComplete]);

  const showBootSkeleton = !initialShellSettings && (loading || !isBootDelayComplete);

  return (
    <div className={styles.shellRoot} data-theme={theme}>
      <ShellHeader />
      {!showBootSkeleton && error ? <p className={styles.error}>{t('error')}: {error}</p> : null}
      {!showBootSkeleton ? <ShellSettingsOverlay /> : null}
      {showBootSkeleton ? (
        <ShellBootSkeleton animate={!isBootDelayComplete} initialShellSettings={initialShellSettings} />
      ) : (
        <WidgetGrid />
      )}
    </div>
  );
}

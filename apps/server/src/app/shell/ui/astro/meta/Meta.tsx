import { DateTime } from 'luxon';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DisplayLocale } from '../../../../../entities/widget/model/types';
import { resolveDisplayLocale } from '@shared/lib/locale';
import { useShellStore } from '../../../model/store';
import styles from './Meta.module.scss';

const CLOCK_TICK_INTERVAL_MS = 1_000;

type MetaProps = {
  initialNowIso: string;
  initialLocale: DisplayLocale;
};

function formatDateTime(nowMs: number, locale: DisplayLocale) {
  const luxonLocale = locale === 'ru' ? 'ru' : 'en';
  const now = DateTime.fromMillis(nowMs).setLocale(luxonLocale);

  return {
    formattedTime: now.toFormat('HH:mm:ss'),
    formattedDate: now.toFormat(locale === 'ru' ? 'cccc, d LLLL' : 'cccc, LLLL d')
  };
}

export function Meta({ initialNowIso, initialLocale }: MetaProps) {
  const seedNowMs = useMemo(() => {
    const parsed = DateTime.fromISO(initialNowIso).toMillis();
    return Number.isFinite(parsed) ? parsed : Date.now();
  }, [initialNowIso]);
  const [locale, setLocale] = useState<DisplayLocale>(initialLocale);
  const [nowMs, setNowMs] = useState(seedNowMs);
  const startMsRef = useRef(Date.now());

  useEffect(() => {
    startMsRef.current = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startMsRef.current;
      setNowMs(seedNowMs + elapsed);
    }, CLOCK_TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [seedNowMs]);

  useEffect(() => {
    const unsubscribe = useShellStore.subscribe((nextState, prevState) => {
      const nextLocale = resolveDisplayLocale(nextState.layoutSettings.locale);
      const prevLocale = resolveDisplayLocale(prevState.layoutSettings.locale);

      if (nextLocale !== prevLocale) {
        setLocale(nextLocale);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const { formattedDate, formattedTime } = useMemo(
    () => formatDateTime(nowMs, locale),
    [locale, nowMs]
  );

  return (
    <div className={styles.clock}>
      <span className={styles.time}>{formattedTime}</span>
      <span className={styles.date}>{formattedDate}</span>
    </div>
  );
}

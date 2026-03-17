import { useCallback, useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import type { WidgetRenderProps } from '../../../entities/widget/model/types';
import { Button } from '@shared/ui/Button';
import { unwrapResultAsync } from '@shared/lib/result';
import { requestJsonResult } from '@shared/lib/request';
import { buildWidgetApiRoute, WEATHER_WIDGET_ID } from '@/widgets';
import { WEATHER_WIDGET_META } from '../meta';
import styles from './WeatherWidget.module.css';

type ForecastDay = {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
};

type WeatherPayload = {
  locationName: string;
  summary: string;
  mood: string;
  days: ForecastDay[];
  fetchedAt: string;
  fromCache: boolean;
};

const FORECAST_DATE_FORMATTER = DateTime.DATE_MED_WITH_WEEKDAY;
const META_DATE_FORMATTER = 'dd.MM, HH:mm';

function describeWeatherCode(code: number) {
  const labels: Record<number, string> = {
    0: 'Ясно',
    1: 'Почти ясно',
    2: 'Переменная облачность',
    3: 'Пасмурно',
    45: 'Туман',
    48: 'Туман с инеем',
    51: 'Слабая морось',
    53: 'Морось',
    55: 'Сильная морось',
    61: 'Слабый дождь',
    63: 'Дождь',
    65: 'Сильный дождь',
    71: 'Слабый снег',
    73: 'Снег',
    75: 'Сильный снег',
    80: 'Ливни',
    81: 'Ливень',
    82: 'Сильный ливень',
    95: 'Гроза',
    96: 'Гроза с градом',
    99: 'Сильная гроза'
  };

  return labels[code] ?? 'Погода уточняется';
}

async function loadForecast(refresh = false) {
  const endpoint = buildWidgetApiRoute(WEATHER_WIDGET_ID, refresh ? 'refresh' : 'forecast');

  return unwrapResultAsync(requestJsonResult<WeatherPayload>(endpoint, {
    method: refresh ? 'POST' : 'GET',
    widget: WEATHER_WIDGET_META
  }, 'Не удалось загрузить прогноз.'));
}

export function WeatherWidget(_props: WidgetRenderProps) {
  const themeClass = _props.theme === 'night' ? styles.night : styles.day;
  const [data, setData] = useState<WeatherPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runLoad = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const next = await loadForecast(refresh);
      setData(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Ошибка погоды.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runLoad(false);
  }, [runLoad]);

  const formatForecastDate = (value: string) =>
    DateTime.fromISO(value).setLocale('ru').toLocaleString(FORECAST_DATE_FORMATTER);
  const formatFetchedAt = (value: string) =>
    DateTime.fromISO(value).setLocale('ru').toFormat(META_DATE_FORMATTER);

  return (
    <div className={[styles.weatherRoot, themeClass].join(' ')}>
      <div className={styles.header}>
        <div>
          <div className={styles.icon}>🌤️</div>
          <h3 className={styles.title}>{data?.locationName ?? 'Батуми'}</h3>
        </div>
        <Button variant="secondary" onClick={() => void runLoad(true)} disabled={loading}>
          {loading ? 'Обновляю...' : 'Обновить'}
        </Button>
      </div>

      {error ? <p className={styles.error}>Ошибка: {error}</p> : null}

      <p className={styles.summary}>{data?.summary ?? 'Загрузка прогноза...'}</p>
      <p className={styles.mood}>{data?.mood ?? '✨ Посмотрим по настроению'}</p>

      <ul className={styles.list}>
        {(data?.days ?? []).map((day) => (
          <li key={day.date}>
            <span>{formatForecastDate(day.date)}</span>
            <span>{describeWeatherCode(day.weatherCode)}</span>
            <strong>{Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°</strong>
          </li>
        ))}
      </ul>

      {data ? (
        <p className={styles.meta}>
          Обновлено: {formatFetchedAt(data.fetchedAt)}
          {data.fromCache ? ' (cache)' : ''}
        </p>
      ) : null}
    </div>
  );
}

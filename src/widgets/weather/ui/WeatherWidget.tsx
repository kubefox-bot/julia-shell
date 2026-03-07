import { useCallback, useEffect, useState } from 'react';
import type { WidgetRenderProps } from '../../../entities/widget/model/types';
import { Button } from '../../../shared/ui/Button';
import styles from './WeatherWidget.module.scss';

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
  const endpoint = refresh
    ? '/api/widget/com.yulia.weather/refresh'
    : '/api/widget/com.yulia.weather/forecast';

  const response = await fetch(endpoint, {
    method: refresh ? 'POST' : 'GET'
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Не удалось загрузить прогноз.');
  }

  return data as WeatherPayload;
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
            <span>{new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(day.date))}</span>
            <span>{describeWeatherCode(day.weatherCode)}</span>
            <strong>{Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°</strong>
          </li>
        ))}
      </ul>

      {data ? (
        <p className={styles.meta}>
          Обновлено: {new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(data.fetchedAt))}
          {data.fromCache ? ' (cache)' : ''}
        </p>
      ) : null}
    </div>
  );
}

import { DateTime } from 'luxon';
import { getWeatherCache, upsertWeatherCache } from './repository';
import type { WidgetServerModule } from '../../../entities/widget/model/types';
import { jsonResponse } from '@shared/lib/http';
import { HTTP_STATUS_INTERNAL_SERVER_ERROR } from '@shared/lib/http-status';
import { requestRaw } from '@shared/lib/request';
import { WEATHER_WIDGET_META } from '../meta';

const FORECAST_DAY_COUNT = Number('3');
const BATUMI_LATITUDE = Number.parseFloat('41.65');
const BATUMI_LONGITUDE = Number.parseFloat('41.64');
const LOCATION_KEY = 'batumi';
const CACHE_TTL_MS = Number('1800000');
const INDOOR_WEATHER_CODES = new Set(['80', '81', '82', '61', '63', '65']);
const OUTDOOR_WEATHER_CODES = new Set(['0', '1']);
type ForecastDay = {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
};

type WeatherPayload = {
  locationKey: string;
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

function getWeatherMood(code: number) {
  if (INDOOR_WEATHER_CODES.has(String(code))) {
    return '☔ Придется дома сидеть';
  }

  if (OUTDOOR_WEATHER_CODES.has(String(code))) {
    return '☀️ Можно погулять';
  }

  return '✨ Посмотрим по настроению';
}

function buildPayload(days: ForecastDay[], fetchedAt: string, fromCache: boolean): WeatherPayload {
  const first = days[0];
  const summary = first
    ? `${describeWeatherCode(first.weatherCode)}, ${Math.round(first.tempMax)}° / ${Math.round(first.tempMin)}°`
    : 'Прогноз пока недоступен';

  return {
    locationKey: LOCATION_KEY,
    locationName: 'Батуми',
    summary,
    mood: first ? getWeatherMood(first.weatherCode) : '✨ Посмотрим по настроению',
    days,
    fetchedAt,
    fromCache
  };
}

async function fetchRemoteForecast(): Promise<ForecastDay[]> {
  const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
  weatherUrl.searchParams.set('latitude', String(BATUMI_LATITUDE));
  weatherUrl.searchParams.set('longitude', String(BATUMI_LONGITUDE));
  weatherUrl.searchParams.set('timezone', 'auto');
  weatherUrl.searchParams.set('forecast_days', '3');
  weatherUrl.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');

  const response = await requestRaw(weatherUrl, {
    headers: {
      'User-Agent': 'Yulia-Assistant/2.0'
    },
    widget: WEATHER_WIDGET_META
  });

  if (!response.ok) {
    throw new Error(`Weather API returned ${response.status}`);
  }

  const payload = await response.json() as {
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
    };
  };

  const daily = payload.daily;

  if (!daily?.time || !daily.weather_code || !daily.temperature_2m_max || !daily.temperature_2m_min) {
    throw new Error('Weather payload is incomplete.');
  }

  return daily.time.slice(0, FORECAST_DAY_COUNT).map((date, index) => ({
    date,
    tempMax: daily.temperature_2m_max?.[index] ?? 0,
    tempMin: daily.temperature_2m_min?.[index] ?? 0,
    weatherCode: daily.weather_code?.[index] ?? 0
  }));
}

async function getWeather(forceRefresh: boolean) {
  const cached = getWeatherCache(LOCATION_KEY);
  const now = DateTime.now().toMillis();

  if (!forceRefresh && cached) {
    const fetchedAtMs = DateTime.fromISO(cached.fetchedAt).toMillis();
    if (Number.isFinite(fetchedAtMs) && now - fetchedAtMs < CACHE_TTL_MS) {
      const parsed = JSON.parse(cached.payload) as ForecastDay[];
      return buildPayload(parsed, cached.fetchedAt, true);
    }
  }

  try {
    const days = await fetchRemoteForecast();
    const fetchedAt = DateTime.now().toISO();
    if (!fetchedAt) {
      throw new Error('Failed to build weather timestamp.');
    }
    upsertWeatherCache(LOCATION_KEY, JSON.stringify(days), fetchedAt);
    return buildPayload(days, fetchedAt, false);
  } catch (error) {
    if (cached) {
      const parsed = JSON.parse(cached.payload) as ForecastDay[];
      return buildPayload(parsed, cached.fetchedAt, true);
    }

    throw error;
  }
}

export const weatherServerModule: WidgetServerModule = {
  handlers: {
    'GET forecast': async () => {
      try {
        const payload = await getWeather(false);
        return jsonResponse(payload);
      } catch (error) {
        return jsonResponse({
          error: error instanceof Error ? error.message : 'Failed to load forecast.'
        }, HTTP_STATUS_INTERNAL_SERVER_ERROR);
      }
    },
    'POST refresh': async () => {
      try {
        const payload = await getWeather(true);
        return jsonResponse(payload);
      } catch (error) {
        return jsonResponse({
          error: error instanceof Error ? error.message : 'Failed to refresh forecast.'
        }, HTTP_STATUS_INTERNAL_SERVER_ERROR);
      }
    }
  }
};

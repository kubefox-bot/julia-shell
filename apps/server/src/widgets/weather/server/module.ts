import { getWeatherCache, upsertWeatherCache } from '@core/db/weather-repository';
import type { WidgetServerModule } from '../../../entities/widget/model/types';
import { jsonResponse } from '../../../shared/lib/http';

const BATUMI_LATITUDE = 41.65;
const BATUMI_LONGITUDE = 41.64;
const LOCATION_KEY = 'batumi';
const WEATHER_FORECAST_DAYS = 3;
const WEATHER_CACHE_TTL_MINUTES = 30;
const MILLISECONDS_PER_SECOND = 1000;
const CACHE_TTL_MS = WEATHER_CACHE_TTL_MINUTES * 60 * MILLISECONDS_PER_SECOND;
const STATUS_INTERNAL_SERVER_ERROR = 500;
const DEFAULT_WEATHER_VALUE = 0;
const WEATHER_CODE_SHOWERS_LIGHT = 80;
const WEATHER_CODE_SHOWERS_MODERATE = 81;
const WEATHER_CODE_SHOWERS_HEAVY = 82;
const WEATHER_CODE_RAIN_LIGHT = 61;
const WEATHER_CODE_RAIN_MODERATE = 63;
const WEATHER_CODE_RAIN_HEAVY = 65;
const RAINY_WEATHER_CODES = [
  WEATHER_CODE_SHOWERS_LIGHT,
  WEATHER_CODE_SHOWERS_MODERATE,
  WEATHER_CODE_SHOWERS_HEAVY,
  WEATHER_CODE_RAIN_LIGHT,
  WEATHER_CODE_RAIN_MODERATE,
  WEATHER_CODE_RAIN_HEAVY,
] as const;
const SUNNY_WEATHER_CODES = [0, 1] as const;

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
  if (RAINY_WEATHER_CODES.includes(code as (typeof RAINY_WEATHER_CODES)[number])) {
    return '☔ Придется дома сидеть';
  }

  if (SUNNY_WEATHER_CODES.includes(code as (typeof SUNNY_WEATHER_CODES)[number])) {
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
  weatherUrl.searchParams.set('forecast_days', String(WEATHER_FORECAST_DAYS));
  weatherUrl.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');

  const response = await fetch(weatherUrl, {
    headers: {
      'User-Agent': 'Yulia-Assistant/2.0'
    }
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

  return daily.time.slice(0, WEATHER_FORECAST_DAYS).map((date, index) => ({
    date,
    tempMax: daily.temperature_2m_max?.[index] ?? DEFAULT_WEATHER_VALUE,
    tempMin: daily.temperature_2m_min?.[index] ?? DEFAULT_WEATHER_VALUE,
    weatherCode: daily.weather_code?.[index] ?? DEFAULT_WEATHER_VALUE
  }));
}

async function getWeather(forceRefresh: boolean) {
  const cached = getWeatherCache(LOCATION_KEY);
  const now = Date.now();

  if (!forceRefresh && cached) {
    const fetchedAtMs = Date.parse(cached.fetchedAt);
    if (Number.isFinite(fetchedAtMs) && now - fetchedAtMs < CACHE_TTL_MS) {
      const parsed = JSON.parse(cached.payload) as ForecastDay[];
      return buildPayload(parsed, cached.fetchedAt, true);
    }
  }

  try {
    const days = await fetchRemoteForecast();
    const fetchedAt = new Date().toISOString();
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
        }, STATUS_INTERNAL_SERVER_ERROR);
      }
    },
    'POST refresh': async () => {
      try {
        const payload = await getWeather(true);
        return jsonResponse(payload);
      } catch (error) {
        return jsonResponse({
          error: error instanceof Error ? error.message : 'Failed to refresh forecast.'
        }, STATUS_INTERNAL_SERVER_ERROR);
      }
    }
  }
};

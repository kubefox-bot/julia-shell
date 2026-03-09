import { nowIso } from '@shared/lib/time';
import { openDb } from '../../../core/db/shared';

export type WeatherCacheRow = {
  locationKey: string;
  payload: string;
  fetchedAt: string;
};

function getDb() {
  const db = openDb('weather.db');
  db.exec(`
    CREATE TABLE IF NOT EXISTS weather_cache (
      location_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

export function getWeatherCache(locationKey: string): WeatherCacheRow | null {
  const db = getDb();
  const row = db
    .prepare('SELECT location_key as locationKey, payload, fetched_at as fetchedAt FROM weather_cache WHERE location_key = ?')
    .get(locationKey) as WeatherCacheRow | undefined;

  return row ?? null;
}

export function upsertWeatherCache(locationKey: string, payload: string, fetchedAt = nowIso()) {
  const db = getDb();
  db.prepare(`
    INSERT INTO weather_cache (location_key, payload, fetched_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(location_key) DO UPDATE SET
      payload = excluded.payload,
      fetched_at = excluded.fetched_at,
      updated_at = excluded.updated_at
  `).run(locationKey, payload, fetchedAt, nowIso());
}

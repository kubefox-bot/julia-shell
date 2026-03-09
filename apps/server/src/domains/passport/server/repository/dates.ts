import { DateTime } from 'luxon';
import { PASSPORT_REFRESH_TTL_DAYS } from '../config/consts';

export function buildEnrollmentTokenExpiresAt(ttlMinutes: number, fallbackIso: string) {
  return DateTime.utc().plus({ minutes: ttlMinutes }).toISO() ?? fallbackIso;
}

export function buildRefreshTokenExpiresAt(fallbackIso: string) {
  return DateTime.utc().plus({ days: PASSPORT_REFRESH_TTL_DAYS }).toISO() ?? fallbackIso;
}

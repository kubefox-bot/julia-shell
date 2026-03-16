import { DateTime } from 'luxon'

const UNIX_EPOCH_ISO = '1970-01-01T00:00:00.000Z'
export const SECONDS_PER_MINUTE = 60
export const MINUTES_PER_HOUR = 60
export const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR
export const HOURS_PER_DAY = 24
export const DAYS_PER_WEEK = 7

export function nowIso() {
  return DateTime.utc().toISO() ?? UNIX_EPOCH_ISO
}

export function nowMillis() {
  return DateTime.utc().toMillis()
}

export function toIsoFromMillis(value: number) {
  return DateTime.fromMillis(value, { zone: 'utc' }).toISO() ?? UNIX_EPOCH_ISO
}

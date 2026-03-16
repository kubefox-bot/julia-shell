import { DateTime } from 'luxon'

const UNIX_EPOCH_ISO = '1970-01-01T00:00:00.000Z'

export function nowIso() {
  return DateTime.utc().toISO() ?? UNIX_EPOCH_ISO
}

export function nowMillis() {
  return DateTime.utc().toMillis()
}

export function toIsoFromMillis(value: number) {
  return DateTime.fromMillis(value, { zone: 'utc' }).toISO() ?? UNIX_EPOCH_ISO
}

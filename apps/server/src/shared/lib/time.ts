import { DateTime } from 'luxon';

export function nowIso() {
  return DateTime.utc().toISO() ?? new Date().toISOString();
}

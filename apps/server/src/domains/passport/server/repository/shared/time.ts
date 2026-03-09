import { DateTime } from 'luxon';

export function isExpiredIso(iso: string) {
  const parsed = DateTime.fromISO(iso, { zone: 'utc' });
  if (!parsed.isValid) {
    return true;
  }

  return parsed.toMillis() <= DateTime.utc().toMillis();
}

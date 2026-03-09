import {
  PASSPORT_ENROLLMENT_DEFAULT_TTL_MINUTES,
  PASSPORT_ENROLLMENT_DEFAULT_USES,
  PASSPORT_ENROLLMENT_MAX_TTL_MINUTES,
  PASSPORT_ENROLLMENT_MAX_USES,
  PASSPORT_ENROLLMENT_MIN_TTL_MINUTES,
  PASSPORT_ENROLLMENT_MIN_USES
} from '@passport/server/config/consts';

export function resolveEnrollmentTtlMinutes(value: number | undefined) {
  return Math.max(
    PASSPORT_ENROLLMENT_MIN_TTL_MINUTES,
    Math.min(PASSPORT_ENROLLMENT_MAX_TTL_MINUTES, Math.round(value ?? PASSPORT_ENROLLMENT_DEFAULT_TTL_MINUTES))
  );
}

export function resolveEnrollmentUses(value: number | undefined) {
  return Math.max(
    PASSPORT_ENROLLMENT_MIN_USES,
    Math.min(PASSPORT_ENROLLMENT_MAX_USES, Math.round(value ?? PASSPORT_ENROLLMENT_DEFAULT_USES))
  );
}

import type { ShellLocale } from '../../entities/widget/model/types';

export const JULIA_LOCALE_COOKIE_NAME = 'julia_locale';
const DAYS_PER_YEAR = 365;
const JULIA_LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * DAYS_PER_YEAR;

function sanitizeLocale(value: string | null | undefined): ShellLocale | null {
  if (value === 'ru' || value === 'en') {
    return value;
  }

  return null;
}

export function parseLocaleCookie(rawCookieHeader: string | null): ShellLocale | null {
  if (!rawCookieHeader?.trim()) {
    return null;
  }

  for (const chunk of rawCookieHeader.split(';')) {
    const [keyPart, ...valueParts] = chunk.split('=');
    const key = keyPart?.trim();
    if (key !== JULIA_LOCALE_COOKIE_NAME) {
      continue;
    }

    return sanitizeLocale(valueParts.join('=').trim());
  }

  return null;
}

export function readLocaleCookieFromDocument(): ShellLocale | null {
  if (typeof document === 'undefined') {
    return null;
  }

  return parseLocaleCookie(document.cookie);
}

export function buildLocaleCookieHeader(input: {
  locale: ShellLocale;
  request: Request;
}) {
  const url = new URL(input.request.url);
  const secure = url.protocol === 'https:';

  return [
    `${JULIA_LOCALE_COOKIE_NAME}=${input.locale}`,
    'Path=/',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    `Max-Age=${JULIA_LOCALE_COOKIE_MAX_AGE_SECONDS}`
  ]
    .filter(Boolean)
    .join('; ');
}

import type { DisplayLocale, ShellLocale, WidgetHeaderName } from '../../entities/widget/model/types';

export function coerceBrowserLocale(locale: string | null | undefined): DisplayLocale {
  if (typeof locale !== 'string') {
    return 'ru';
  }

  const lower = locale.toLowerCase();
  if (lower.startsWith('en')) {
    return 'en';
  }

  if (lower.startsWith('ru')) {
    return 'ru';
  }

  return 'ru';
}

export function resolveDisplayLocale(shellLocale: ShellLocale): DisplayLocale {
  return shellLocale;
}

export function getLocalizedHeader(headerName: WidgetHeaderName, locale: DisplayLocale) {
  return locale === 'en' ? headerName.en : headerName.ru;
}

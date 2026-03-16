import type { ShellLocale, ShellTheme } from '../../entities/widget/model/types'

export function sanitizeLocale(value: string | null | undefined): ShellLocale {
  if (value === 'ru' || value === 'en') {
    return value
  }

  return 'ru'
}

export function sanitizeTheme(value: string | null | undefined): ShellTheme {
  if (value === 'auto' || value === 'day' || value === 'night') {
    return value
  }

  return 'auto'
}

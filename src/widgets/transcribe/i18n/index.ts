import type { DisplayLocale, HostPlatform } from '../../../entities/widget/model/types'
import { transcribeEn } from './en'
import { transcribeRu } from './ru'

const dictionaries = {
  en: transcribeEn,
  ru: transcribeRu
} as const

type Dictionary = typeof transcribeRu
export type TranscribeTextKey = keyof Dictionary
const transcribeKeys = new Set<TranscribeTextKey>(Object.keys(transcribeRu) as TranscribeTextKey[])

export function getTranscribeText(locale: DisplayLocale, key: TranscribeTextKey, vars?: Record<string, string | number>) {
  const template = String(dictionaries[locale][key] ?? dictionaries.ru[key])
  if (!vars) {
    return template
  }

  return Object.entries(vars).reduce<string>(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template
  )
}

export function isTranscribeTextKey(value: string): value is TranscribeTextKey {
  return transcribeKeys.has(value as TranscribeTextKey)
}

export function getPlatformLabel(locale: DisplayLocale, platform: HostPlatform) {
  const key = platform === 'windows'
    ? 'labelPlatformWindows'
    : platform === 'macos'
      ? 'labelPlatformMacos'
      : 'labelPlatformLinux'

  return getTranscribeText(locale, key)
}

export function getSecretSourceLabel(locale: DisplayLocale, source: 'infisical' | 'db' | 'env' | 'missing') {
  const key = source === 'infisical'
    ? 'labelSourceInfisical'
    : source === 'db'
      ? 'labelSourceDb'
      : source === 'env'
        ? 'labelSourceEnv'
        : 'labelSourceMissing'

  return getTranscribeText(locale, key)
}

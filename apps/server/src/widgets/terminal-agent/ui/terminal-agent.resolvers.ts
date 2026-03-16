import type { TerminalAgentDictionary } from './terminal-agent.dictionary'
import type { Provider, SettingsPayload } from './terminal-agent.types'
import styles from './TerminalAgentWidget.module.css'
import { isQuotaErrorMessage } from './terminal-agent.utils'

const STATUS_LABEL_KEYS = {
  idle: 'statusIdle',
  running: 'statusRunning',
  resuming: 'statusResuming',
  thinking: 'statusThinking',
  tool_call: 'statusToolCall',
  done: 'statusDone',
  error: 'statusError',
} as const

const PROVIDER_MODEL_FALLBACK = {
  codex: 'Codex',
  gemini: 'Gemini',
} as const

export function resolveThemeClass(theme: 'day' | 'night') {
  return theme === 'night' ? styles.night : styles.day
}

export function resolveActionThemeClass(theme: 'day' | 'night') {
  return theme === 'night' ? styles.actionButtonNight : ''
}

export function resolveLocalizedStatus(statusLine: string, dictionary: TerminalAgentDictionary) {
  const key = STATUS_LABEL_KEYS[statusLine as keyof typeof STATUS_LABEL_KEYS]
  return key ? dictionary[key] : statusLine
}

export function resolveDisplayError(error: string | null, dictionary: TerminalAgentDictionary) {
  if (!error) {
    return null
  }
  return isQuotaErrorMessage(error) ? dictionary.quotaExceeded : error
}

export function resolveActiveModel(settings: SettingsPayload | null, provider: Provider) {
  if (!settings) {
    return ''
  }

  const modelMap = {
    codex: settings.codexModel,
    gemini: settings.geminiModel,
  } as const

  return modelMap[provider]
}

export function resolveModelLine(input: {
  locale: 'ru' | 'en'
  provider: Provider
  activeModel: string
}) {
  const prefix = input.locale === 'ru' ? 'Модель' : 'Model'
  const fallback = PROVIDER_MODEL_FALLBACK[input.provider]
  return `${prefix}: ${input.activeModel || fallback}`
}

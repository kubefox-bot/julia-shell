import type { TerminalAgentProvider } from '../../../domains/llm/server/repository/terminal-agent-repository'
import {
  DIALOG_TITLE_MAX,
  GEMINI_API_KEY_MISSING_MESSAGE,
  GEMINI_QUOTA_MESSAGE,
  PROVIDER_EXIT_CODE_41,
  TOOL_DETAIL_MAX,
} from './message-stream.constants'

type ErrorResolutionInput = {
  rawMessage: string
  provider: TerminalAgentProvider
  quotaDetected: boolean
  geminiApiKeyDetected: boolean
}

export function truncateToolDetail(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length <= TOOL_DETAIL_MAX) {
    return normalized
  }
  return `${normalized.slice(0, TOOL_DETAIL_MAX - 1)}…`
}

export function isGeminiQuotaDetail(value: string) {
  const text = value.toLowerCase()
  return text.includes('quota exceeded')
    || text.includes('exhausted your daily quota')
    || text.includes('exceeded your current quota')
    || text.includes('terminalquotaerror')
    || text.includes('code: 429')
}

export function isGeminiApiKeyMissingDetail(value: string) {
  const text = value.toLowerCase()
  return text.includes('must specify the gemini_api_key environment variable')
    || (text.includes('gemini_api_key') && text.includes('environment variable') && text.includes('must specify'))
}

export function isGeminiApiKeyFollowupDetail(value: string) {
  return value.toLowerCase().includes('update your environment and try again')
}

export function shouldHideToolDetail(value: string) {
  const text = value.trim()
  if (!text) {
    return true
  }

  const lower = text.toLowerCase()
  return lower.startsWith('at ')
    || lower.includes('node:internal')
    || lower.includes('file:///')
    || lower.includes('googlequotaerrors.js')
    || lower.includes('geminichat.')
}

export function createDialogTitle(message: string) {
  const compact = message.trim().replace(/\s+/g, ' ')
  if (!compact) {
    return ''
  }
  if (compact.length <= DIALOG_TITLE_MAX) {
    return compact
  }
  return `${compact.slice(0, DIALOG_TITLE_MAX - 1)}…`
}

export function resolveStreamErrorMessage(input: ErrorResolutionInput) {
  const candidates = [
    input.quotaDetected || isGeminiQuotaDetail(input.rawMessage) ? GEMINI_QUOTA_MESSAGE : null,
    input.provider === 'gemini'
      && (input.geminiApiKeyDetected || input.rawMessage.toLowerCase().includes(PROVIDER_EXIT_CODE_41))
      ? GEMINI_API_KEY_MISSING_MESSAGE
      : null,
  ]

  return candidates.find((value) => typeof value === 'string') ?? input.rawMessage
}

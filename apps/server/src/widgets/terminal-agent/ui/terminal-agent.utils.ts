import type { ParsedSseChunk, Provider } from './terminal-agent.types'

const DATA_PREFIX_LENGTH = 5
const EVENT_PREFIX_LENGTH = 6

export function parseSseEventChunk(rawEvent: string): ParsedSseChunk | null {
  const lines = rawEvent.split('\n')
  let eventName = 'message'
  const dataLines: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (line.startsWith('event:')) {
      eventName = line.slice(EVENT_PREFIX_LENGTH).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(DATA_PREFIX_LENGTH).trimStart())
    }
  }

  if (dataLines.length === 0) {
    return null
  }

  try {
    const payload = JSON.parse(dataLines.join('\n')) as Record<string, unknown>
    return { eventName, payload }
  } catch {
    return null
  }
}

export function parseArgsInput(value: string) {
  return value
    .split(' ')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function getMessagesStorageKey(provider: Provider, sessionRef: string) {
  return `terminal-agent:messages:${provider}:${sessionRef || '__current'}`
}

export function normalizeForCompare(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function appendChunkWithSpacing(previous: string, chunk: string) {
  if (!previous || !chunk) {
    return previous + chunk
  }

  const prevLast = previous.at(-1) ?? ''
  const nextFirst = chunk[0] ?? ''
  const prevIsWord = /[\p{L}\p{N}]/u.test(prevLast)
  const nextIsWord = /[\p{L}\p{N}]/u.test(nextFirst)
  if (!prevIsWord || !nextIsWord) {
    return `${previous}${chunk}`
  }

  const nextIsLowerLetter = /\p{Ll}/u.test(nextFirst)
  const needsGap = !nextIsLowerLetter

  return needsGap ? `${previous} ${chunk}` : `${previous}${chunk}`
}

export function isQuotaErrorMessage(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized.includes('quota exceeded')
    || normalized.includes('exhausted your daily quota')
    || normalized.includes('exceeded your current quota')
    || normalized.includes('terminalquotaerror')
}

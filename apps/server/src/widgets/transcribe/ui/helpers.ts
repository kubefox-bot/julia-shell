import { getTranscribeText } from '../i18n'
import type { BrowserEntry } from './model/types'

const TRANSCRIPT_SPEAKER_LINE_PATTERN = /^(\s*\[\d{2}:\d{2}:\d{2}\]\s*)([^:\n—-]+?)(\s*(?::|—|-)\s*)(.*)$/u

type TranscriptSpeakerMatch = {
  prefix: string
  speakerLabel: string
  speakerKey: string
  separator: string
  rest: string
}

export function parseSseEventChunk(rawEvent: string) {
  const lines = rawEvent.split('\n')
  let eventName = 'message'
  const dataLines: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
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

export function isSupportedAudioEntry(entry: BrowserEntry) {
  return entry.type === 'file' && /\.(m4a|opus)$/i.test(entry.name)
}

export function getVisibleAudioFilePaths(sourceEntries: BrowserEntry[]) {
  return sourceEntries.filter((entry) => isSupportedAudioEntry(entry)).map((entry) => entry.path)
}

export function filterSelectedAudioFiles(next: string[], sourceEntries: BrowserEntry[]) {
  const visiblePaths = new Set(getVisibleAudioFilePaths(sourceEntries).map((value) => value.toLowerCase()))

  return next.filter((value, index, source) => {
    const normalized = value.toLowerCase()
    return visiblePaths.has(normalized) && source.findIndex((candidate) => candidate.toLowerCase() === normalized) === index
  })
}

export function findMatchingTranscriptPath(primaryAudioPath: string | null, entries: BrowserEntry[]) {
  if (!primaryAudioPath) {
    return null
  }

  const transcriptFileName = primaryAudioPath
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.(m4a|opus)$/i, '.txt')
    .toLowerCase()

  if (!transcriptFileName) {
    return null
  }

  return entries.find((entry) => entry.type === 'file' && entry.name.toLowerCase() === transcriptFileName)?.path ?? null
}

export function findReadableAudioPath(selectedAudioFiles: string[], entries: BrowserEntry[]) {
  const candidates = selectedAudioFiles.length > 0
    ? selectedAudioFiles
    : entries.filter((entry) => isSupportedAudioEntry(entry)).map((entry) => entry.path)

  for (const audioPath of candidates) {
    if (findMatchingTranscriptPath(audioPath, entries)) {
      return audioPath
    }
  }

  return null
}

export function formatSelectedAudioFiles(locale: 'ru' | 'en', paths: string[]) {
  if (paths.length === 0) {
    return getTranscribeText(locale, 'helperSelectedFilesEmpty')
  }

  return paths
    .map((filePath, index) => `${index + 1}. ${filePath.split(/[\\/]/).pop() ?? filePath}`)
    .join(' • ')
}

export function upsertEntry(entries: BrowserEntry[], nextEntry: BrowserEntry) {
  const exists = entries.some((entry) => entry.path.toLowerCase() === nextEntry.path.toLowerCase())
  if (exists) {
    return entries
  }

  return [...entries, nextEntry].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name, 'ru')
  })
}

export function normalizeSpeakerKey(rawSpeaker: string) {
  return rawSpeaker.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function normalizeTranscriptText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]*((?:\[\d{2}:\d{2}:\d{2}\]))/g, '\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trimStart()
}

function matchTranscriptSpeakerLine(line: string): TranscriptSpeakerMatch | null {
  const match = line.match(TRANSCRIPT_SPEAKER_LINE_PATTERN)
  if (!match) {
    return null
  }

  const [, prefix, speakerLabel, separator, rest] = match
  const normalizedSpeaker = speakerLabel.trim()
  if (!normalizedSpeaker) {
    return null
  }

  return {
    prefix,
    speakerLabel: normalizedSpeaker,
    speakerKey: normalizeSpeakerKey(normalizedSpeaker),
    separator,
    rest
  }
}

export function extractTranscriptSpeakers(text: string) {
  const uniqueByKey = new Map<string, string>()
  const lines = normalizeTranscriptText(text).split('\n')

  for (const line of lines) {
    const match = matchTranscriptSpeakerLine(line)
    if (!match || uniqueByKey.has(match.speakerKey)) {
      continue
    }
    uniqueByKey.set(match.speakerKey, match.speakerLabel)
  }

  return Array.from(uniqueByKey.entries()).map(([speakerKey, speakerLabel]) => ({
    speakerKey,
    speakerLabel
  }))
}

export function applySpeakerAliasesToTranscript(text: string, aliases: Record<string, string>) {
  const normalizedText = normalizeTranscriptText(text)
  const lines = normalizedText.split('\n')

  return lines.map((line) => {
    const match = matchTranscriptSpeakerLine(line)
    if (!match) {
      return line
    }

    const alias = aliases[match.speakerKey]?.trim()
    if (!alias) {
      return line
    }

    return `${match.prefix}${alias}${match.separator}${match.rest}`
  }).join('\n')
}

import { normalizeSpeakerKey } from '../helpers'
import type { SpeakerAliasEntry } from '../model/types'

export function toSpeakerAliasRecord(entries: SpeakerAliasEntry[]) {
  const nextAliases: Record<string, string> = {}
  for (const entry of entries) {
    const key = normalizeSpeakerKey(entry.speakerKey)
    const value = entry.aliasName.trim()
    if (!key || !value) {
      continue
    }
    nextAliases[key] = value
  }
  return nextAliases
}

export function toSpeakerAliasPayload(entries: SpeakerAliasEntry[]) {
  return entries.map((entry) => ({
    speakerKey: normalizeSpeakerKey(entry.speakerKey),
    aliasName: entry.aliasName.trim()
  }))
}

import { DateTime } from 'luxon'
import { nowIso } from '@shared/lib/time'

let recentFolderTouchSequence = 0

export function nextRecentFolderTimestamp() {
  const value = DateTime.utc()
    .plus({ milliseconds: recentFolderTouchSequence })
    .toISO()
  recentFolderTouchSequence += 1
  return value ?? nowIso()
}

export function normalizeSpeakerKey(rawSpeaker: string) {
  return rawSpeaker.replace(/\s+/g, ' ').trim().toLowerCase()
}

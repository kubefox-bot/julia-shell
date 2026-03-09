let recentFolderTouchSequence = 0

export function nextRecentFolderTimestamp() {
  const value = new Date(Date.now() + recentFolderTouchSequence).toISOString()
  recentFolderTouchSequence += 1
  return value
}

export function normalizeSpeakerKey(rawSpeaker: string) {
  return rawSpeaker.replace(/\s+/g, ' ').trim().toLowerCase()
}

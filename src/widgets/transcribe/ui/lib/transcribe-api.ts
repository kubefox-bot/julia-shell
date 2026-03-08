import type { SpeakerAliasEntry, TranscribeSettingsPayload } from '../model/types'
import type { FsListResponse, JsonErrorShape, TranscriptReadResponse, TranscriptSaveResponse } from './types'

function readErrorMessage(data: unknown, fallback: string) {
  if (typeof data === 'object' && data !== null) {
    const shape = data as JsonErrorShape
    if (typeof shape.error === 'string' && shape.error.trim()) {
      return shape.error
    }
  }
  return fallback
}

async function readJson<T>(response: Response) {
  return await response.json() as T
}

export async function fetchTranscribeSettings() {
  const response = await fetch('/api/widget/com.yulia.transcribe/settings')
  const data = await readJson<TranscribeSettingsPayload | JsonErrorShape>(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data, 'Failed to load settings.'))
  }

  return data as TranscribeSettingsPayload
}

export async function saveTranscribeSettings(payload: { geminiModel: string; apiKey?: string }) {
  const response = await fetch('/api/widget/com.yulia.transcribe/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await readJson<TranscribeSettingsPayload | JsonErrorShape>(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data, 'Failed to save settings.'))
  }

  return data as TranscribeSettingsPayload
}

export async function fetchTranscribeFolder(path: string) {
  const response = await fetch('/api/widget/com.yulia.transcribe/fs-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  })
  const data = await readJson<FsListResponse | JsonErrorShape>(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data, 'Failed to read path.'))
  }

  const typed = data as FsListResponse
  return {
    path: typed.path,
    entries: typed.entries,
    recentFolders: Array.isArray(typed.recentFolders) ? typed.recentFolders : []
  }
}

export async function fetchSpeakerAliases() {
  const response = await fetch('/api/widget/com.yulia.transcribe/speaker-aliases')
  const data = await readJson<{ aliases?: SpeakerAliasEntry[] } | JsonErrorShape>(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data, 'Failed to load speaker aliases.'))
  }

  return Array.isArray(data.aliases) ? data.aliases : []
}

export async function saveSpeakerAliases(aliases: SpeakerAliasEntry[]) {
  const response = await fetch('/api/widget/com.yulia.transcribe/speaker-aliases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aliases })
  })
  const data = await readJson<{ aliases?: SpeakerAliasEntry[] } | JsonErrorShape>(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data, 'Failed to save speaker aliases.'))
  }

  return Array.isArray(data.aliases) ? data.aliases : []
}

export async function readTranscript(payload: {
  sourceFile: string
  folderPath: string | null
  txtPath: string
}) {
  const response = await fetch('/api/widget/com.yulia.transcribe/transcript-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await readJson<TranscriptReadResponse | JsonErrorShape>(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data, 'Failed to open .txt file.'))
  }

  return data as TranscriptReadResponse
}

export async function saveTranscript(payload: {
  sourceFile: string | null
  folderPath: string | null
  txtPath: string | null
  transcript: string
}) {
  const response = await fetch('/api/widget/com.yulia.transcribe/transcript-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await readJson<TranscriptSaveResponse | JsonErrorShape>(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data, 'Failed to save transcript.'))
  }

  return data as TranscriptSaveResponse
}

export async function openTranscribeStream(payload: {
  folderPath: string
  filePaths: string[]
}) {
  const response = await fetch('/api/widget/com.yulia.transcribe/transcribe-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null)
    throw new Error(readErrorMessage(data, 'Transcription failed.'))
  }

  return response.body
}

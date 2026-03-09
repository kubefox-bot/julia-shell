import type { SpeakerAliasEntry, TranscribeSettingsPayload } from '../model/types'
import { transcribeManifest } from '../../manifest'
import { fetchWithRequestHeaders } from '@shared/lib/request-headers'
import type {
  FsListResponse,
  JsonErrorShape,
  TranscriptReadResponse,
  TranscriptSaveResponse,
  WidgetProviderResponse
} from './types'

function readErrorMessage(data: unknown, fallback: string) {
  if (typeof data === 'object' && data !== null) {
    const shape = data as JsonErrorShape
    if (typeof shape.error === 'string' && shape.error.trim()) {
      return shape.error
    }
  }
  return fallback
}

function readAliases(data: unknown) {
  if (typeof data !== 'object' || data === null || !('aliases' in data)) {
    return [] as SpeakerAliasEntry[]
  }

  const { aliases } = data as { aliases?: unknown }
  return Array.isArray(aliases) ? aliases as SpeakerAliasEntry[] : []
}

async function readJson<T>(response: Response) {
  return await response.json() as T
}

const WIDGET_META = {
  id: transcribeManifest.id,
  version: transcribeManifest.version,
} as const

export async function fetchTranscribeProvider() {
  const response = await fetchWithRequestHeaders(
    '/api/passport/widget/provider?widget_id=com.yulia.transcribe',
    undefined,
    { widget: WIDGET_META }
  )
  const data = await readJson<WidgetProviderResponse | JsonErrorShape>(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data, 'Failed to resolve widget provider state.'))
  }

  return data as WidgetProviderResponse
}

export async function fetchTranscribeSettings() {
  const response = await fetchWithRequestHeaders('/api/widget/com.yulia.transcribe/settings', undefined, {
    widget: WIDGET_META,
  })
  const data = await readJson<TranscribeSettingsPayload | JsonErrorShape>(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data, 'Failed to load settings.'))
  }

  return data as TranscribeSettingsPayload
}

export async function saveTranscribeSettings(payload: { geminiModel: string; apiKey?: string }) {
  const response = await fetchWithRequestHeaders('/api/widget/com.yulia.transcribe/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, { widget: WIDGET_META })
  const data = await readJson<TranscribeSettingsPayload | JsonErrorShape>(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data, 'Failed to save settings.'))
  }

  return data as TranscribeSettingsPayload
}

export async function fetchTranscribeFolder(path: string) {
  const response = await fetchWithRequestHeaders('/api/widget/com.yulia.transcribe/fs-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  }, { widget: WIDGET_META })
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
  const response = await fetchWithRequestHeaders('/api/widget/com.yulia.transcribe/speaker-aliases', undefined, {
    widget: WIDGET_META,
  })
  const data = await readJson<{ aliases?: SpeakerAliasEntry[] } | JsonErrorShape>(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data, 'Failed to load speaker aliases.'))
  }

  return readAliases(data)
}

export async function saveSpeakerAliases(aliases: SpeakerAliasEntry[]) {
  const response = await fetchWithRequestHeaders('/api/widget/com.yulia.transcribe/speaker-aliases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aliases })
  }, { widget: WIDGET_META })
  const data = await readJson<{ aliases?: SpeakerAliasEntry[] } | JsonErrorShape>(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data, 'Failed to save speaker aliases.'))
  }

  return readAliases(data)
}

export async function readTranscript(payload: {
  sourceFile: string
  folderPath: string | null
  txtPath: string
}) {
  const response = await fetchWithRequestHeaders('/api/widget/com.yulia.transcribe/transcript-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, { widget: WIDGET_META })
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
  const response = await fetchWithRequestHeaders('/api/widget/com.yulia.transcribe/transcript-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, { widget: WIDGET_META })
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
  const response = await fetchWithRequestHeaders('/api/widget/com.yulia.transcribe/transcribe-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, { widget: WIDGET_META })

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null)
    throw new Error(readErrorMessage(data, 'Transcription failed.'))
  }

  return response.body
}

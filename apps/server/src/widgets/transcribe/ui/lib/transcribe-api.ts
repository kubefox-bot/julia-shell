import type { SpeakerAliasEntry, TranscribeSettingsPayload } from '../model/types'
import { defineQuery, requestBody, requestJson } from '@shared/lib/request'
import { buildWidgetApiRoute, buildWidgetProviderRoute, TRANSCRIBE_WIDGET_ID } from '@/widgets'
import { TRANSCRIBE_WIDGET_META } from '../../meta'
import type {
  FsListResponse,
  TranscriptReadResponse,
  TranscriptSaveResponse,
  WidgetProviderResponse
} from './types'

function readAliases(data: unknown) {
  if (typeof data !== 'object' || data === null || !('aliases' in data)) {
    return [] as SpeakerAliasEntry[]
  }

  const { aliases } = data as { aliases?: unknown }
  return Array.isArray(aliases) ? aliases as SpeakerAliasEntry[] : []
}

export async function fetchTranscribeProvider() {
  return requestJson<WidgetProviderResponse>(
    buildWidgetProviderRoute(TRANSCRIBE_WIDGET_ID),
    { widget: TRANSCRIBE_WIDGET_META },
    'Failed to resolve widget provider state.'
  )
}

export async function fetchTranscribeSettings() {
  return requestJson<TranscribeSettingsPayload>(buildWidgetApiRoute(TRANSCRIBE_WIDGET_ID, 'settings'), {
    widget: TRANSCRIBE_WIDGET_META,
  }, 'Failed to load settings.')
}

export async function saveTranscribeSettings(payload: { geminiModel: string; apiKey?: string }) {
  return requestJson<TranscribeSettingsPayload>(buildWidgetApiRoute(TRANSCRIBE_WIDGET_ID, 'settings'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    widget: TRANSCRIBE_WIDGET_META
  }, 'Failed to save settings.')
}

export async function fetchTranscribeFolder(path: string) {
  const typed = await requestJson<FsListResponse>(buildWidgetApiRoute(TRANSCRIBE_WIDGET_ID, 'fs-list'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
    widget: TRANSCRIBE_WIDGET_META
  }, 'Failed to read path.')
  return {
    path: typed.path,
    entries: typed.entries,
    recentFolders: Array.isArray(typed.recentFolders) ? typed.recentFolders : []
  }
}

export async function fetchSpeakerAliases() {
  const data = await requestJson<{ aliases?: SpeakerAliasEntry[] }>(buildWidgetApiRoute(TRANSCRIBE_WIDGET_ID, 'speaker-aliases'), {
    widget: TRANSCRIBE_WIDGET_META,
  }, 'Failed to load speaker aliases.')

  return readAliases(data)
}

export async function saveSpeakerAliases(aliases: SpeakerAliasEntry[]) {
  const data = await requestJson<{ aliases?: SpeakerAliasEntry[] }>(buildWidgetApiRoute(TRANSCRIBE_WIDGET_ID, 'speaker-aliases'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aliases }),
    widget: TRANSCRIBE_WIDGET_META
  }, 'Failed to save speaker aliases.')

  return readAliases(data)
}

export async function readTranscript(payload: {
  sourceFile: string
  folderPath: string | null
  txtPath: string
}) {
  return requestJson<TranscriptReadResponse>(buildWidgetApiRoute(TRANSCRIBE_WIDGET_ID, 'transcript-read'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    widget: TRANSCRIBE_WIDGET_META
  }, 'Failed to open .txt file.')
}

export async function saveTranscript(payload: {
  sourceFile: string | null
  folderPath: string | null
  txtPath: string | null
  transcript: string
}) {
  return requestJson<TranscriptSaveResponse>(buildWidgetApiRoute(TRANSCRIBE_WIDGET_ID, 'transcript-save'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    widget: TRANSCRIBE_WIDGET_META
  }, 'Failed to save transcript.')
}

export async function openTranscribeStream(payload: {
  folderPath: string
  filePaths: string[]
}) {
  return requestBody(buildWidgetApiRoute(TRANSCRIBE_WIDGET_ID, 'transcribe-stream'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    widget: TRANSCRIBE_WIDGET_META
  }, 'Transcription failed.')
}

export const transcribeQueryKeys = {
  provider: () => ['transcribe', 'provider'] as const,
  settings: () => ['transcribe', 'settings'] as const,
  speakerAliases: () => ['transcribe', 'speaker-aliases'] as const
}

export const transcribeProviderQuery = defineQuery(transcribeQueryKeys.provider(), fetchTranscribeProvider)
export const transcribeSettingsQuery = defineQuery(transcribeQueryKeys.settings(), fetchTranscribeSettings)
export const transcribeSpeakerAliasesQuery = defineQuery(transcribeQueryKeys.speakerAliases(), fetchSpeakerAliases)

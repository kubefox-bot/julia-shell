import type { BrowserEntry } from '../model/types'

export type FsListResponse = {
  path: string
  entries: BrowserEntry[]
  recentFolders?: string[]
}

export type TranscriptReadResponse = {
  txtPath?: string
  transcript?: string
}

export type TranscriptSaveResponse = {
  txtPath?: string
}

export type JsonErrorShape = {
  error?: unknown
}

export type WidgetProviderResponse = {
  widgetId: string
  status: 'ready' | 'requires_access_token' | 'agent_offline' | 'unsupported_widget'
  ready: boolean
  requiresAccessToken: boolean
  hasAccessToken: boolean
  requiresOnlineAgent: boolean
  hasOnlineAgent: boolean
  reason: string | null
}

export type StreamProgressHandler = (percent: number, stage: string) => void | Promise<void>
export type StreamTokenHandler = (text: string) => void | Promise<void>
export type StreamDoneHandler = (payload: { transcript: string; savePath: string }) => void | Promise<void>

export type ConsumeTranscribeStreamHandlers = {
  onProgress: StreamProgressHandler
  onToken: StreamTokenHandler
  onDone: StreamDoneHandler
}

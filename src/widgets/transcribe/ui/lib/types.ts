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

export type StreamProgressHandler = (percent: number, stage: string) => void | Promise<void>
export type StreamTokenHandler = (text: string) => void | Promise<void>
export type StreamDoneHandler = (payload: { transcript: string; savePath: string }) => void | Promise<void>

export type ConsumeTranscribeStreamHandlers = {
  onProgress: StreamProgressHandler
  onToken: StreamTokenHandler
  onDone: StreamDoneHandler
}

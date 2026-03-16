import type { ChildProcess } from 'node:child_process'
import type { SsePayload, UploadedGeminiFile } from './types'

export type StreamRuntime = {
  send: (event: string, payload: SsePayload) => void
  sendProgress: (percent: number, stage: string) => void
  close: () => void
  setActiveChild: (child: ChildProcess | null) => void
  isAborted: () => boolean
}

export type RunTranscribeStreamInput = {
  runtime: StreamRuntime
  agentId: string
  folderPath: string
  filePath: string
  filePaths: string[]
  selectedModel: string
  geminiModelCandidates: string[]
  apiKey: string | null
  setJobId: (id: string) => void
}

export type TranscribeJobContext = {
  filePaths: string[]
  canonicalSourceFile: string
  resolvedFolderPath: string
  primaryBaseName: string
  jobId: string
}

export type TempArtifacts = {
  mergedAudioPath: string
  concatListPath: string
  convertedAudioPath: string
  uploadedFile: UploadedGeminiFile | null
}

import path from 'node:path'
import {
  appendTranscribeOutboxEvent,
  createTranscribeJob,
  touchRecentFolder,
} from '@core/db/transcribe-repository'
import { DEFAULT_GEMINI_MODEL, TOOLS_ROOT, WIDGET_ID } from './constants'
import { prepareAudioForTranscription } from './ffmpeg'
import type { RunTranscribeStreamInput, TranscribeJobContext } from './transcribe-stream-types'
import { findBinary, getHostPlatform, resolveSelection } from './utils'

const JOB_CREATED_PROGRESS_PERCENT = 2

export async function createJobContext(input: RunTranscribeStreamInput): Promise<TranscribeJobContext> {
  input.runtime.sendProgress(JOB_CREATED_PROGRESS_PERCENT, 'progressCheckingSelection')
  const selection = await resolveSelection(input.folderPath, input.filePath, input.filePaths)
  const { filePaths, canonicalSourceFile, resolvedFolderPath } = selection
  const primaryBaseName = path.parse(canonicalSourceFile).name

  touchRecentFolder(input.agentId, WIDGET_ID, resolvedFolderPath)
  appendTranscribeOutboxEvent({
    agentId: input.agentId,
    widgetId: WIDGET_ID,
    eventType: 'audio_selected',
    state: 'selected',
    payload: { folderPath: resolvedFolderPath, filePaths, primarySourceFile: canonicalSourceFile },
  })

  const jobId = createTranscribeJob({
    agentId: input.agentId,
    widgetId: WIDGET_ID,
    folderPath: resolvedFolderPath,
    filePaths,
    primarySourceFile: canonicalSourceFile,
    platform: getHostPlatform(),
    model: input.selectedModel || DEFAULT_GEMINI_MODEL,
  })
  input.setJobId(jobId)

  appendTranscribeOutboxEvent({
    agentId: input.agentId,
    widgetId: WIDGET_ID,
    jobId,
    eventType: 'job_created',
    state: 'queued',
    payload: { folderPath: resolvedFolderPath, filePaths, model: input.selectedModel },
  })
  appendTranscribeOutboxEvent({
    agentId: input.agentId,
    widgetId: WIDGET_ID,
    jobId,
    eventType: 'processing_started',
    state: 'processing',
    payload: { stage: 'started' },
  })

  input.runtime.send('progress', { percent: JOB_CREATED_PROGRESS_PERCENT, stage: 'progressJobCreated', jobId })
  return { ...selection, primaryBaseName, jobId }
}

export async function prepareAudio(input: RunTranscribeStreamInput, jobContext: TranscribeJobContext) {
  const ffmpegExe = await findBinary(
    path.join(TOOLS_ROOT, 'ffmpeg'),
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  )
  if (!ffmpegExe) {
    throw new Error('ffmpeg binary not found in tools/ffmpeg or PATH.')
  }

  return prepareAudioForTranscription({
    ffmpegExe,
    selectedFiles: jobContext.filePaths,
    primaryBaseName: jobContext.primaryBaseName,
    sendProgress: input.runtime.sendProgress,
    setActiveChild: (child) => input.runtime.setActiveChild(child),
  })
}

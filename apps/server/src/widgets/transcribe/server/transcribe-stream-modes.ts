import fs from 'node:fs/promises'
import path from 'node:path'
import { GoogleGenAI } from '@google/genai'
import { appendTranscribeOutboxEvent, completeTranscribeJob } from './repository'
import {
  GEMINI_UPLOAD_MIME,
  MOCK_GEMINI_MODEL,
  PROMPT_PATH,
  WIDGET_ID,
} from './constants'
import { startGeminiStream } from './gemini'
import { runMockTranscription } from './mock'
import type {
  RunTranscribeStreamInput,
  TempArtifacts,
  TranscribeJobContext,
} from './transcribe-stream-types'
import type { UploadedGeminiFile } from './types'

const UPLOAD_PROGRESS_PERCENT = 60
const TRANSCRIBING_PROGRESS_START_PERCENT = 72
const TRANSCRIBING_PROGRESS_MAX_PERCENT = 98
const MAX_PROGRESS_PERCENT = 100
const TOKEN_PROGRESS_STEP_DIVISOR = 120
const MIN_TOKEN_PROGRESS_STEP = 1

function emitCompleted(agentId: string, jobId: string, model: string, sourceFile: string, savePath: string) {
  appendTranscribeOutboxEvent({
    agentId,
    widgetId: WIDGET_ID,
    jobId,
    eventType: 'transcription_completed',
    state: 'completed',
    payload: { model, sourceFile },
  })
  appendTranscribeOutboxEvent({
    agentId,
    widgetId: WIDGET_ID,
    jobId,
    eventType: 'file_created',
    state: 'ready',
    payload: { savePath },
  })
}

export async function handleMock(
  input: RunTranscribeStreamInput,
  context: TranscribeJobContext,
  convertedAudioPath: string
) {
  const result = await runMockTranscription({
    selectedFiles: context.filePaths,
    resolvedFolderPath: context.resolvedFolderPath,
    primaryBaseName: context.primaryBaseName,
    convertedAudioPath,
    sendProgress: input.runtime.sendProgress,
    send: input.runtime.send,
    jobId: context.jobId,
  })

  completeTranscribeJob(context.jobId, result.savePath)
  emitCompleted(input.agentId, context.jobId, MOCK_GEMINI_MODEL, context.canonicalSourceFile, result.savePath)
  input.runtime.send('done', {
    status: 'ready',
    sourceFile: context.canonicalSourceFile,
    savePath: result.savePath,
    transcript: result.transcript,
    model: MOCK_GEMINI_MODEL,
    jobId: context.jobId,
  })
}

async function collectGeminiTranscript(input: RunTranscribeStreamInput, model: string, jobId: string, response: Awaited<ReturnType<typeof startGeminiStream>>['response']) {
  let transcript = ''
  let rollingProgress = TRANSCRIBING_PROGRESS_START_PERCENT

  for await (const chunk of response) {
    if (input.runtime.isAborted()) {
      break
    }
    const text = typeof chunk.text === 'string' ? chunk.text : ''
    if (!text) {
      continue
    }
    transcript += text
    rollingProgress = Math.min(
      TRANSCRIBING_PROGRESS_MAX_PERCENT,
      rollingProgress + Math.max(MIN_TOKEN_PROGRESS_STEP, Math.ceil(text.length / TOKEN_PROGRESS_STEP_DIVISOR))
    )
    input.runtime.sendProgress(rollingProgress, 'progressTranscribing')
    input.runtime.send('token', { text, model, jobId })
  }

  return transcript
}

export async function handleGemini(
  input: RunTranscribeStreamInput,
  context: TranscribeJobContext,
  artifacts: TempArtifacts
) {
  const prompt = (await fs.readFile(PROMPT_PATH, 'utf8')).trim()
  if (!prompt) {
    throw new Error('Transcript.md is empty.')
  }
  if (!input.apiKey) {
    throw new Error('GEMINI_API_KEY is missing in settings, env, or Infisical.')
  }

  input.runtime.sendProgress(UPLOAD_PROGRESS_PERCENT, 'progressUploading')
  const ai = new GoogleGenAI({ apiKey: input.apiKey })
  artifacts.uploadedFile = (await ai.files.upload({
    file: artifacts.convertedAudioPath,
    config: { mimeType: GEMINI_UPLOAD_MIME, displayName: path.basename(artifacts.convertedAudioPath) },
  })) as UploadedGeminiFile

  input.runtime.sendProgress(TRANSCRIBING_PROGRESS_START_PERCENT, 'progressTranscribing')
  const streamResult = await startGeminiStream(ai, prompt, artifacts.uploadedFile, input.geminiModelCandidates)
  const transcript = await collectGeminiTranscript(
    input,
    streamResult.model,
    context.jobId,
    streamResult.response
  )
  if (!transcript.trim()) {
    throw new Error('Gemini returned an empty transcript.')
  }

  const savePath = path.join(context.resolvedFolderPath, `${context.primaryBaseName}.txt`)
  await fs.writeFile(savePath, transcript, 'utf8')
  input.runtime.sendProgress(MAX_PROGRESS_PERCENT, 'progressDone')
  completeTranscribeJob(context.jobId, savePath)
  emitCompleted(input.agentId, context.jobId, streamResult.model, context.canonicalSourceFile, savePath)
  input.runtime.send('done', {
    status: 'ready',
    sourceFile: context.canonicalSourceFile,
    savePath,
    transcript,
    model: streamResult.model,
    jobId: context.jobId,
  })
}

export async function cleanupArtifacts(artifacts: TempArtifacts, apiKey: string | null) {
  if (artifacts.uploadedFile?.name && apiKey) {
    const ai = new GoogleGenAI({ apiKey })
    await ai.files.delete({ name: artifacts.uploadedFile.name }).catch(() => undefined)
  }
  if (artifacts.convertedAudioPath) {
    await fs.unlink(artifacts.convertedAudioPath).catch(() => undefined)
  }
  if (artifacts.mergedAudioPath) {
    await fs.unlink(artifacts.mergedAudioPath).catch(() => undefined)
  }
  if (artifacts.concatListPath) {
    await fs.unlink(artifacts.concatListPath).catch(() => undefined)
  }
}

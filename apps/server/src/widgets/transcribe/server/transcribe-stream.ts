import type { ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { GoogleGenAI } from '@google/genai'
import {
  appendTranscribeOutboxEvent,
  completeTranscribeJob,
  createTranscribeJob,
  failTranscribeJob,
  getTranscribeWidgetSettings,
  touchRecentFolder,
  updateTranscribeJobProgress,
} from '../../../core/db/transcribe-repository'
import { readRuntimeEnv } from '../../../core/env'
import { jsonResponse } from '../../../shared/lib/http'
import { isTranscribeDevBypassMode } from './agent-mode'
import { handleAgentTranscribeStream } from './agent-transcribe-stream'
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_UPLOAD_MIME,
  MOCK_GEMINI_MODEL,
  PROMPT_PATH,
  TOOLS_ROOT,
  WIDGET_ID,
} from './constants'
import { prepareAudioForTranscription } from './ffmpeg'
import { startGeminiStream } from './gemini'
import { runMockTranscription } from './mock'
import { resolveApiKeyState } from './settings'
import type { SsePayload, UploadedGeminiFile } from './types'
import {
  buildGeminiModelCandidates,
  findBinary,
  getHostPlatform,
  resolveConfiguredModel,
  resolveSelection,
  toSseEvent,
} from './utils'

export async function handleTranscribeStream(
  body: {
    folderPath?: string
    filePath?: string
    filePaths?: string[]
  },
  request: Request,
  agentId: string
) {
  const runtimeEnv = readRuntimeEnv()
  const devBypassMode = isTranscribeDevBypassMode()
  const allowMockFallback = devBypassMode && runtimeEnv.transcribeAgentMockModeEnabled

  if (!devBypassMode) {
    const agentResponse = await handleAgentTranscribeStream(body, request, agentId)
    if (!(allowMockFallback && agentResponse.status === 503)) {
      return agentResponse
    }
  }

  const folderPath = typeof body.folderPath === 'string' ? body.folderPath.trim() : ''
  const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : ''
  const filePaths = Array.isArray(body.filePaths) ? body.filePaths : []

  if (!folderPath && !filePath && filePaths.length === 0) {
    return jsonResponse({ error: 'folderPath or filePaths is required.' }, 400)
  }

  const widgetSettings = getTranscribeWidgetSettings(agentId, WIDGET_ID)
  const secretState = await resolveApiKeyState(agentId)
  const selectedModel = resolveConfiguredModel(widgetSettings.geminiModel)
  const geminiModelCandidates = buildGeminiModelCandidates(selectedModel)

  if (selectedModel !== MOCK_GEMINI_MODEL && !secretState.value) {
    return jsonResponse({ error: 'GEMINI_API_KEY is missing in settings, env, or Infisical.' }, 400)
  }

  let activeChild: ChildProcess | null = null
  let closed = false
  let aborted = false
  let lastProgress = -1
  let abortHandler: (() => void) | null = null
  let jobId = ''

  const stopActiveChild = () => {
    if (activeChild && !activeChild.killed) {
      activeChild.kill()
    }
    activeChild = null
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (event: string, payload: SsePayload) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(toSseEvent(event, payload)))
        } catch {
          closed = true
          aborted = true
          stopActiveChild()
        }
      }

      const close = () => {
        if (closed) return
        closed = true
        stopActiveChild()
        if (abortHandler) {
          request.signal.removeEventListener('abort', abortHandler)
          abortHandler = null
        }
        try {
          controller.close()
        } catch {
          // ignored
        }
      }

      const sendProgress = (percent: number, stage: string) => {
        const normalized = Math.max(0, Math.min(100, Math.round(percent)))
        const monotonic = Math.max(lastProgress, normalized)
        if (monotonic === lastProgress) return
        lastProgress = monotonic
        if (jobId) {
          updateTranscribeJobProgress(jobId, monotonic)
        }
        send('progress', { percent: monotonic, stage })
      }

      const run = async () => {
        let mergedAudioPath = ''
        let concatListPath = ''
        let convertedAudioPath = ''
        let uploadedFile: UploadedGeminiFile | null = null

        try {
          sendProgress(2, 'progressCheckingSelection')
          const selection = await resolveSelection(folderPath, filePath, filePaths)
          const { filePaths: selectedFiles, canonicalSourceFile, resolvedFolderPath } = selection
          const primaryBaseName = path.parse(canonicalSourceFile).name

          touchRecentFolder(agentId, WIDGET_ID, resolvedFolderPath)
          appendTranscribeOutboxEvent({
            agentId,
            widgetId: WIDGET_ID,
            eventType: 'audio_selected',
            state: 'selected',
            payload: {
              folderPath: resolvedFolderPath,
              filePaths: selectedFiles,
              primarySourceFile: canonicalSourceFile,
            },
          })

          jobId = createTranscribeJob({
            agentId,
            widgetId: WIDGET_ID,
            folderPath: resolvedFolderPath,
            filePaths: selectedFiles,
            primarySourceFile: canonicalSourceFile,
            platform: getHostPlatform(),
            model: selectedModel || DEFAULT_GEMINI_MODEL,
          })

          appendTranscribeOutboxEvent({
            agentId,
            widgetId: WIDGET_ID,
            jobId,
            eventType: 'job_created',
            state: 'queued',
            payload: {
              folderPath: resolvedFolderPath,
              filePaths: selectedFiles,
              model: selectedModel,
            },
          })

          send('progress', { percent: 2, stage: 'progressJobCreated', jobId })
          appendTranscribeOutboxEvent({
            agentId,
            widgetId: WIDGET_ID,
            jobId,
            eventType: 'processing_started',
            state: 'processing',
            payload: {
              stage: 'started',
            },
          })

          const ffmpegExe = await findBinary(
            path.join(TOOLS_ROOT, 'ffmpeg'),
            process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
          )
          if (!ffmpegExe) {
            throw new Error('ffmpeg binary not found in tools/ffmpeg or PATH.')
          }

          const preparedAudio = await prepareAudioForTranscription({
            ffmpegExe,
            selectedFiles,
            primaryBaseName,
            sendProgress,
            setActiveChild: (child) => {
              activeChild = child
            },
          })
          mergedAudioPath = preparedAudio.mergedAudioPath
          concatListPath = preparedAudio.concatListPath
          convertedAudioPath = preparedAudio.convertedAudioPath

          if (aborted) return

          if (selectedModel === MOCK_GEMINI_MODEL) {
            const mockResult = await runMockTranscription({
              selectedFiles,
              resolvedFolderPath,
              primaryBaseName,
              convertedAudioPath,
              sendProgress,
              send,
              jobId,
            })

            completeTranscribeJob(jobId, mockResult.savePath)
            appendTranscribeOutboxEvent({
              agentId,
              widgetId: WIDGET_ID,
              jobId,
              eventType: 'transcription_completed',
              state: 'completed',
              payload: {
                model: MOCK_GEMINI_MODEL,
                sourceFile: canonicalSourceFile,
              },
            })
            appendTranscribeOutboxEvent({
              agentId,
              widgetId: WIDGET_ID,
              jobId,
              eventType: 'file_created',
              state: 'ready',
              payload: {
                savePath: mockResult.savePath,
              },
            })
            send('done', {
              status: 'ready',
              sourceFile: canonicalSourceFile,
              savePath: mockResult.savePath,
              transcript: mockResult.transcript,
              model: MOCK_GEMINI_MODEL,
              jobId,
            })
            close()
            return
          }

          const prompt = (await fs.readFile(PROMPT_PATH, 'utf8')).trim()
          if (!prompt) {
            throw new Error('Transcript.md is empty.')
          }

          sendProgress(60, 'progressUploading')
          const ai = new GoogleGenAI({ apiKey: secretState.value })
          uploadedFile = (await ai.files.upload({
            file: convertedAudioPath,
            config: {
              mimeType: GEMINI_UPLOAD_MIME,
              displayName: path.basename(convertedAudioPath),
            },
          })) as UploadedGeminiFile

          if (aborted) return

          sendProgress(72, 'progressTranscribing')
          const { model, response } = await startGeminiStream(
            ai,
            prompt,
            uploadedFile,
            geminiModelCandidates
          )
          let transcript = ''
          let rollingProgress = 72

          for await (const chunk of response) {
            if (aborted) break

            const text = typeof chunk.text === 'string' ? chunk.text : ''
            if (!text) {
              continue
            }

            transcript += text
            rollingProgress = Math.min(
              98,
              rollingProgress + Math.max(1, Math.ceil(text.length / 120))
            )
            sendProgress(rollingProgress, 'progressTranscribing')
            send('token', { text, model, jobId })
          }

          if (aborted) return
          if (!transcript.trim()) {
            throw new Error('Gemini returned an empty transcript.')
          }

          const savePath = path.join(resolvedFolderPath, `${primaryBaseName}.txt`)
          await fs.writeFile(savePath, transcript, 'utf8')

          sendProgress(100, 'progressDone')
          completeTranscribeJob(jobId, savePath)
          appendTranscribeOutboxEvent({
            agentId,
            widgetId: WIDGET_ID,
            jobId,
            eventType: 'transcription_completed',
            state: 'completed',
            payload: {
              model,
              sourceFile: canonicalSourceFile,
            },
          })
          appendTranscribeOutboxEvent({
            agentId,
            widgetId: WIDGET_ID,
            jobId,
            eventType: 'file_created',
            state: 'ready',
            payload: {
              savePath,
            },
          })
          send('done', {
            status: 'ready',
            sourceFile: canonicalSourceFile,
            savePath,
            transcript,
            model,
            jobId,
          })
          close()
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Transcription failed.'
          if (jobId) {
            failTranscribeJob(jobId, message)
          }
          appendTranscribeOutboxEvent({
            agentId,
            widgetId: WIDGET_ID,
            jobId: jobId || null,
            eventType: 'job_failed',
            state: 'failed',
            payload: {
              message,
            },
          })
          if (!aborted) {
            send('error', { message, jobId })
          }
          close()
        } finally {
          if (uploadedFile?.name && secretState.value) {
            const ai = new GoogleGenAI({ apiKey: secretState.value })
            await ai.files.delete({ name: uploadedFile.name }).catch(() => undefined)
          }
          if (convertedAudioPath) {
            await fs.unlink(convertedAudioPath).catch(() => undefined)
          }
          if (mergedAudioPath) {
            await fs.unlink(mergedAudioPath).catch(() => undefined)
          }
          if (concatListPath) {
            await fs.unlink(concatListPath).catch(() => undefined)
          }
        }
      }

      void run()

      abortHandler = () => {
        aborted = true
        close()
      }
      request.signal.addEventListener('abort', abortHandler)
    },
    cancel() {
      aborted = true
      closed = true
      stopActiveChild()
      if (abortHandler) {
        request.signal.removeEventListener('abort', abortHandler)
        abortHandler = null
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

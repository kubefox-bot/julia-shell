import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { GoogleGenAI } from '@google/genai'
import {
  appendTranscribeOutboxEvent,
  completeTranscribeJob,
  createTranscribeJob,
  failTranscribeJob,
  getTranscribeWidgetSettings,
  touchRecentFolder,
  updateTranscribeJobProgress
} from '../../../core/db/transcribe-repository'
import { jsonResponse } from '../../../shared/lib/http'
import { DEFAULT_GEMINI_MODEL, GEMINI_UPLOAD_MIME, MOCK_GEMINI_MODEL, PROMPT_PATH, TMP_ROOT, TOOLS_ROOT, WIDGET_ID } from './constants'
import { startGeminiStream } from './gemini'
import { runMockTranscription } from './mock'
import { resolveApiKeyState } from './settings'
import type { SsePayload, UploadedGeminiFile } from './types'
import {
  buildGeminiModelCandidates,
  escapeConcatPath,
  findBinary,
  getHostPlatform,
  parseClockToSeconds,
  resolveConfiguredModel,
  resolveSelection,
  toSseEvent
} from './utils'

export async function handleTranscribeStream(body: {
  folderPath?: string
  filePath?: string
  filePaths?: string[]
}, request: Request) {
  const folderPath = typeof body.folderPath === 'string' ? body.folderPath.trim() : ''
  const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : ''
  const filePaths = Array.isArray(body.filePaths) ? body.filePaths : []

  if (!folderPath && !filePath && filePaths.length === 0) {
    return jsonResponse({ error: 'folderPath or filePaths is required.' }, 400)
  }

  const widgetSettings = getTranscribeWidgetSettings(WIDGET_ID)
  const secretState = await resolveApiKeyState()
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
          let inputFilePath = canonicalSourceFile

          touchRecentFolder(WIDGET_ID, resolvedFolderPath)
          appendTranscribeOutboxEvent({
            widgetId: WIDGET_ID,
            eventType: 'audio_selected',
            state: 'selected',
            payload: {
              folderPath: resolvedFolderPath,
              filePaths: selectedFiles,
              primarySourceFile: canonicalSourceFile
            }
          })

          jobId = createTranscribeJob({
            widgetId: WIDGET_ID,
            folderPath: resolvedFolderPath,
            filePaths: selectedFiles,
            primarySourceFile: canonicalSourceFile,
            platform: getHostPlatform(),
            model: selectedModel || DEFAULT_GEMINI_MODEL
          })

          appendTranscribeOutboxEvent({
            widgetId: WIDGET_ID,
            jobId,
            eventType: 'job_created',
            state: 'queued',
            payload: {
              folderPath: resolvedFolderPath,
              filePaths: selectedFiles,
              model: selectedModel
            }
          })

          send('progress', { percent: 2, stage: 'progressJobCreated', jobId })
          appendTranscribeOutboxEvent({
            widgetId: WIDGET_ID,
            jobId,
            eventType: 'processing_started',
            state: 'processing',
            payload: {
              stage: 'started'
            }
          })

          if (selectedModel === MOCK_GEMINI_MODEL) {
            const mockResult = await runMockTranscription({
              selectedFiles,
              resolvedFolderPath,
              primaryBaseName,
              sendProgress,
              send,
              jobId
            })

            completeTranscribeJob(jobId, mockResult.savePath)
            appendTranscribeOutboxEvent({
              widgetId: WIDGET_ID,
              jobId,
              eventType: 'transcription_completed',
              state: 'completed',
              payload: {
                model: MOCK_GEMINI_MODEL,
                sourceFile: canonicalSourceFile
              }
            })
            appendTranscribeOutboxEvent({
              widgetId: WIDGET_ID,
              jobId,
              eventType: 'file_created',
              state: 'ready',
              payload: {
                savePath: mockResult.savePath
              }
            })
            send('done', {
              status: 'ready',
              sourceFile: canonicalSourceFile,
              savePath: mockResult.savePath,
              transcript: mockResult.transcript,
              model: MOCK_GEMINI_MODEL,
              jobId
            })
            close()
            return
          }

          const ffmpegExe = await findBinary(path.join(TOOLS_ROOT, 'ffmpeg'), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
          if (!ffmpegExe) {
            throw new Error('ffmpeg binary not found in tools/ffmpeg.')
          }

          const prompt = (await fs.readFile(PROMPT_PATH, 'utf8')).trim()
          if (!prompt) {
            throw new Error('Transcript.md is empty.')
          }

          await fs.mkdir(TMP_ROOT, { recursive: true })

          if (selectedFiles.length > 1) {
            mergedAudioPath = path.join(TMP_ROOT, `${primaryBaseName}_merged.m4a`)
            concatListPath = path.join(TMP_ROOT, `${primaryBaseName}_merged.concat.txt`)
            await fs.writeFile(
              concatListPath,
              selectedFiles.map((value) => `file '${escapeConcatPath(value)}'`).join('\n'),
              'utf8'
            )

            sendProgress(6, 'progressMerging')
            await new Promise<void>((resolve, reject) => {
              const ffmpeg = spawn(
                ffmpegExe,
                [
                  '-y',
                  '-f',
                  'concat',
                  '-safe',
                  '0',
                  '-i',
                  concatListPath,
                  '-vn',
                  '-c:a',
                  'aac',
                  '-b:a',
                  '96k',
                  mergedAudioPath
                ],
                { windowsHide: true, cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
              )

              activeChild = ffmpeg
              let stderrBuffer = ''
              ffmpeg.stderr.setEncoding('utf8')
              ffmpeg.stderr.on('data', (chunk: string) => {
                stderrBuffer += chunk
              })
              ffmpeg.on('error', (error) => reject(error))
              ffmpeg.on('close', (code) => {
                activeChild = null
                if (code === 0) {
                  sendProgress(18, 'progressMergeComplete')
                  resolve()
                  return
                }
                reject(new Error(stderrBuffer.trim() || `ffmpeg exited with code ${code}`))
              })
            })

            inputFilePath = mergedAudioPath
          }

          if (aborted) return

          const convertBaseName = selectedFiles.length > 1 ? `${primaryBaseName}_merged` : primaryBaseName
          convertedAudioPath = path.join(TMP_ROOT, `${convertBaseName}.mono16k.ogg`)
          const conversionStart = selectedFiles.length > 1 ? 20 : 5
          const conversionEnd = selectedFiles.length > 1 ? 52 : 40

          sendProgress(conversionStart, 'progressConverting')
          await new Promise<void>((resolve, reject) => {
            const ffmpeg = spawn(
              ffmpegExe,
              [
                '-y',
                '-i',
                inputFilePath,
                '-vn',
                '-ac',
                '1',
                '-ar',
                '16000',
                '-c:a',
                'libopus',
                '-b:a',
                '24k',
                '-vbr',
                'on',
                '-compression_level',
                '10',
                convertedAudioPath
              ],
              { windowsHide: true, cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
            )

            activeChild = ffmpeg
            let stderrBuffer = ''
            let durationSeconds = 0

            ffmpeg.stderr.setEncoding('utf8')
            ffmpeg.stderr.on('data', (chunk: string) => {
              stderrBuffer += chunk

              if (!durationSeconds) {
                const durationMatch = stderrBuffer.match(/Duration:\s(\d{2}:\d{2}:\d{2}\.\d+)/)
                if (durationMatch) {
                  durationSeconds = parseClockToSeconds(durationMatch[1])
                }
              }

              const timeMatches = [...chunk.matchAll(/time=(\d{2}:\d{2}:\d{2}\.\d+)/g)]
              if (durationSeconds > 0 && timeMatches.length > 0) {
                const currentSeconds = parseClockToSeconds(timeMatches[timeMatches.length - 1][1])
                const ratio = Math.max(0, Math.min(1, currentSeconds / durationSeconds))
                sendProgress(conversionStart + ratio * (conversionEnd - conversionStart), 'progressConverting')
              }
            })

            ffmpeg.on('error', (error) => reject(error))
            ffmpeg.on('close', (code) => {
              activeChild = null
              if (code === 0) {
                sendProgress(conversionEnd, 'progressConversionComplete')
                resolve()
                return
              }
              reject(new Error(stderrBuffer.trim() || `ffmpeg exited with code ${code}`))
            })
          })

          if (aborted) return

          sendProgress(60, 'progressUploading')
          const ai = new GoogleGenAI({ apiKey: secretState.value })
          uploadedFile = await ai.files.upload({
            file: convertedAudioPath,
            config: {
              mimeType: GEMINI_UPLOAD_MIME,
              displayName: path.basename(convertedAudioPath)
            }
          }) as UploadedGeminiFile

          if (aborted) return

          sendProgress(72, 'progressTranscribing')
          const { model, response } = await startGeminiStream(ai, prompt, uploadedFile, geminiModelCandidates)
          let transcript = ''
          let rollingProgress = 72

          for await (const chunk of response) {
            if (aborted) break

            const text = typeof chunk.text === 'string' ? chunk.text : ''
            if (!text) {
              continue
            }

            transcript += text
            rollingProgress = Math.min(98, rollingProgress + Math.max(1, Math.ceil(text.length / 120)))
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
            widgetId: WIDGET_ID,
            jobId,
            eventType: 'transcription_completed',
            state: 'completed',
            payload: {
              model,
              sourceFile: canonicalSourceFile
            }
          })
          appendTranscribeOutboxEvent({
            widgetId: WIDGET_ID,
            jobId,
            eventType: 'file_created',
            state: 'ready',
            payload: {
              savePath
            }
          })
          send('done', {
            status: 'ready',
            sourceFile: canonicalSourceFile,
            savePath,
            transcript,
            model,
            jobId
          })
          close()
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Transcription failed.'
          if (jobId) {
            failTranscribeJob(jobId, message)
          }
          appendTranscribeOutboxEvent({
            widgetId: WIDGET_ID,
            jobId: jobId || null,
            eventType: 'job_failed',
            state: 'failed',
            payload: {
              message
            }
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
    }
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}

import type { ChildProcess } from 'node:child_process'
import { getTranscribeWidgetSettings, updateTranscribeJobProgress } from '@core/db/transcribe-repository'
import { readRuntimeEnv } from '@core/env'
import { jsonResponse } from '../../../shared/lib/http'
import { isTranscribeDevBypassMode } from './agent-mode'
import { handleAgentTranscribeStream } from './agent-transcribe-stream'
import { MOCK_GEMINI_MODEL, WIDGET_ID } from './constants'
import { resolveApiKeyState } from './settings'
import { runTranscribeStream } from './transcribe-stream-runner'
import { buildGeminiModelCandidates, resolveConfiguredModel, toSseEvent } from './utils'

const STATUS_BAD_REQUEST = 400
const STATUS_OK = 200
const STATUS_SERVICE_UNAVAILABLE = 503
const MAX_PROGRESS_PERCENT = 100

export async function handleTranscribeStream(
  body: { folderPath?: string; filePath?: string; filePaths?: string[] },
  request: Request,
  agentId: string
) {
  const runtimeEnv = readRuntimeEnv()
  const devBypassMode = isTranscribeDevBypassMode()
  const allowMockFallback = devBypassMode && runtimeEnv.transcribeAgentMockModeEnabled
  if (!devBypassMode) {
    const agentResponse = await handleAgentTranscribeStream(body, request, agentId)
    if (!(allowMockFallback && agentResponse.status === STATUS_SERVICE_UNAVAILABLE)) {
      return agentResponse
    }
  }

  const folderPath = typeof body.folderPath === 'string' ? body.folderPath.trim() : ''
  const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : ''
  const filePaths = Array.isArray(body.filePaths) ? body.filePaths : []
  if (!folderPath && !filePath && filePaths.length === 0) {
    return jsonResponse({ error: 'folderPath or filePaths is required.' }, STATUS_BAD_REQUEST)
  }

  const widgetSettings = getTranscribeWidgetSettings(agentId, WIDGET_ID)
  const secretState = await resolveApiKeyState(agentId)
  const selectedModel = resolveConfiguredModel(widgetSettings.geminiModel)
  const geminiModelCandidates = buildGeminiModelCandidates(selectedModel)
  if (selectedModel !== MOCK_GEMINI_MODEL && !secretState.value) {
    return jsonResponse(
      { error: 'GEMINI_API_KEY is missing in settings, env, or Infisical.' },
      STATUS_BAD_REQUEST
    )
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

      const send = (event: string, payload: Record<string, unknown>) => {
        if (closed) {
          return
        }
        try {
          controller.enqueue(encoder.encode(toSseEvent(event, payload)))
        } catch {
          closed = true
          aborted = true
          stopActiveChild()
        }
      }

      const close = () => {
        if (closed) {
          return
        }
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
        const normalized = Math.max(0, Math.min(MAX_PROGRESS_PERCENT, Math.round(percent)))
        const monotonic = Math.max(lastProgress, normalized)
        if (monotonic === lastProgress) {
          return
        }
        lastProgress = monotonic
        if (jobId) {
          updateTranscribeJobProgress(jobId, monotonic)
        }
        send('progress', { percent: monotonic, stage })
      }

      void runTranscribeStream({
        runtime: {
          send,
          sendProgress,
          close,
          setActiveChild: (child) => {
            activeChild = child
          },
          isAborted: () => aborted || closed,
        },
        agentId,
        folderPath,
        filePath,
        filePaths,
        selectedModel,
        geminiModelCandidates,
        apiKey: secretState.value,
        setJobId: (id) => {
          jobId = id
        },
      })

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
    status: STATUS_OK,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

import type { ChildProcess } from 'node:child_process'
import { getTranscribeWidgetSettings, updateTranscribeJobProgress } from './repository'
import { readRuntimeEnv } from '@core/env'
import { jsonResponse } from '@shared/lib/http'
import { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_OK, HTTP_STATUS_SERVICE_UNAVAILABLE } from '@shared/lib/http-status'
import {
  TRANSCRIBE_PROGRESS_INITIAL_PERCENT,
  TRANSCRIBE_PROGRESS_MAX_PERCENT,
  TRANSCRIBE_PROGRESS_MIN_PERCENT,
} from '../progress'
import { isTranscribeDevBypassMode } from './agent-mode'
import { handleAgentTranscribeStream } from './agent-transcribe-stream'
import { MOCK_GEMINI_MODEL, WIDGET_ID } from './constants'
import { resolveApiKeyState } from './settings'
import { runTranscribeStream } from './transcribe-stream-runner'
import type { RunTranscribeStreamInput, StreamRuntime } from './transcribe-stream-types'
import { buildGeminiModelCandidates, resolveConfiguredModel, toSseEvent } from './utils'

function createValidationErrorResponse() {
  return jsonResponse({ error: 'folderPath or filePaths is required.' }, HTTP_STATUS_BAD_REQUEST)
}

function createSseHeaders() {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  }
}

function createStreamRuntime(input: {
  controller: ReadableStreamDefaultController<Uint8Array>
  request: Request
  setClosed: (value: boolean) => void
  isClosed: () => boolean
  setAborted: (value: boolean) => void
  isAborted: () => boolean
}) {
  const encoder = new TextEncoder()
  let activeChild: ChildProcess | null = null

  const stopActiveChild = () => {
    if (activeChild && !activeChild.killed) {
      activeChild.kill()
    }
    activeChild = null
  }

  const runtime: StreamRuntime = {
    send: (event, payload) => {
      if (input.isClosed()) {
        return
      }

      try {
        input.controller.enqueue(encoder.encode(toSseEvent(event, payload)))
      } catch {
        input.setClosed(true)
        input.setAborted(true)
        stopActiveChild()
      }
    },
    sendProgress: () => undefined,
    close: () => {
      if (input.isClosed()) {
        return
      }

      input.setClosed(true)
      stopActiveChild()
      try {
        input.controller.close()
      } catch {
        // ignored
      }
    },
    setActiveChild: (child) => {
      activeChild = child
    },
    isAborted: input.isAborted
  }

  const abortHandler = () => {
    input.setAborted(true)
    runtime.close()
  }

  input.request.signal.addEventListener('abort', abortHandler)

  return {
    runtime,
    cleanupAbortListener: () => {
      input.request.signal.removeEventListener('abort', abortHandler)
    }
  }
}

function createSendProgress(runtime: StreamRuntime, getJobId: () => string) {
  let lastProgress = TRANSCRIBE_PROGRESS_INITIAL_PERCENT

  return (percent: number, stage: string) => {
    const normalized = Math.max(
      TRANSCRIBE_PROGRESS_MIN_PERCENT,
      Math.min(TRANSCRIBE_PROGRESS_MAX_PERCENT, Math.round(percent))
    )
    const monotonic = Math.max(lastProgress, normalized)
    if (monotonic === lastProgress) {
      return
    }

    lastProgress = monotonic
    const jobId = getJobId()
    if (jobId) {
      updateTranscribeJobProgress(jobId, monotonic)
    }
    runtime.send('progress', { percent: monotonic, stage, jobId: jobId || undefined })
  }
}

export async function handleTranscribeStream(
  body: {
    folderPath?: string
    filePath?: string
    filePaths?: string[]
  },
  request: Request,
  agentId: string
) {
  const devBypassMode = isTranscribeDevBypassMode()
  const allowMockFallback = devBypassMode && readRuntimeEnv().transcribeAgentMockModeEnabled

  if (!devBypassMode) {
    const agentResponse = await handleAgentTranscribeStream(body, request, agentId)
    if (!(allowMockFallback && agentResponse.status === HTTP_STATUS_SERVICE_UNAVAILABLE)) {
      return agentResponse
    }
  }

  const folderPath = typeof body.folderPath === 'string' ? body.folderPath.trim() : ''
  const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : ''
  const filePaths = Array.isArray(body.filePaths) ? body.filePaths : []

  if (!folderPath && !filePath && filePaths.length === 0) {
    return createValidationErrorResponse()
  }

  const widgetSettings = getTranscribeWidgetSettings(agentId, WIDGET_ID)
  const secretState = await resolveApiKeyState(agentId)
  const selectedModel = resolveConfiguredModel(widgetSettings.geminiModel)
  if (selectedModel !== MOCK_GEMINI_MODEL && !secretState.value) {
    return jsonResponse(
      { error: 'GEMINI_API_KEY is missing in settings, env, or Infisical.' },
      HTTP_STATUS_BAD_REQUEST
    )
  }

  let closed = false
  let aborted = false
  let jobId = ''

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const { runtime, cleanupAbortListener } = createStreamRuntime({
        controller,
        request,
        setClosed: (value) => {
          closed = value
        },
        isClosed: () => closed,
        setAborted: (value) => {
          aborted = value
        },
        isAborted: () => aborted
      })

      const sendProgress = createSendProgress(runtime, () => jobId)
      runtime.sendProgress = sendProgress

      const runInput: RunTranscribeStreamInput = {
        runtime,
        agentId,
        folderPath,
        filePath,
        filePaths,
        selectedModel,
        geminiModelCandidates: buildGeminiModelCandidates(selectedModel),
        apiKey: secretState.value || null,
        setJobId: (id) => {
          jobId = id
        }
      }

      void runTranscribeStream(runInput).finally(() => {
        cleanupAbortListener()
      })
    },
    cancel() {
      aborted = true
      closed = true
    }
  })

  return new Response(stream, {
    status: HTTP_STATUS_OK,
    headers: createSseHeaders()
  })
}

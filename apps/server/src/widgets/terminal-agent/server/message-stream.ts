import { randomUUID } from 'node:crypto'
import { passportRuntime } from '@passport/server/runtime'
import { getTerminalAgentDialogState, getTerminalAgentSettings } from '../../../domains/llm/server/repository/terminal-agent-repository'
import { jsonResponse } from '@shared/lib/http'
import { moduleBus } from '@shared/lib/module-bus'
import { WIDGET_ID } from './constants'
import { markDialogStatus } from './settings'
import type { TerminalAgentProvider } from '../../../domains/llm/server/repository/terminal-agent-repository'
import { toSseEvent } from './utils'

type BusPayload = {
  type?: string
  payload?: Record<string, unknown>
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function withModelArgs(baseArgs: string[], model: string) {
  const next = [...baseArgs]
  const trimmedModel = model.trim()
  if (!trimmedModel) {
    return next
  }

  const hasModelArg = next.some((entry, index) => {
    if (entry === '--model' || entry === '-m') {
      return true
    }
    return entry.startsWith('--model=') || (entry === '-m' && typeof next[index + 1] === 'string')
  })

  if (!hasModelArg) {
    next.push('--model', trimmedModel)
  }

  return next
}

const STREAM_IDLE_TIMEOUT_MS = 20_000

export async function handleTerminalAgentMessageStream(input: {
  request: Request
  agentId: string
  provider: TerminalAgentProvider
  message: string
}) {
  const onlineAgent = passportRuntime.getOnlineAgentSession()
  if (!onlineAgent) {
    return jsonResponse({ error: 'agent_offline' }, 503)
  }

  const settings = getTerminalAgentSettings(input.agentId, WIDGET_ID)
  const currentState = getTerminalAgentDialogState(input.agentId, WIDGET_ID, input.provider)
  const dialogId = randomUUID()
  const topic = `agent:widget:${WIDGET_ID}:${dialogId}`

  const providerSettings = input.provider === 'codex'
    ? {
        apiKey: settings.codexApiKey,
      commandPath: settings.codexCommand,
      commandArgs: withModelArgs(settings.codexArgs, settings.codexModel),
    }
  : {
      apiKey: settings.geminiApiKey,
      commandPath: settings.geminiCommand,
      commandArgs: withModelArgs(settings.geminiArgs, settings.geminiModel),
    }

  markDialogStatus({
    agentId: input.agentId,
    provider: input.provider,
    status: currentState.providerSessionRef ? 'resuming' : 'running',
    lastError: null,
  })

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      let idleTimer: ReturnType<typeof setTimeout> | null = null

      const send = (event: string, payload: Record<string, unknown>) => {
        if (closed) {
          return
        }

        controller.enqueue(encoder.encode(toSseEvent(event, payload)))
      }

      const close = () => {
        if (closed) {
          return
        }

        closed = true
        if (idleTimer) {
          clearTimeout(idleTimer)
          idleTimer = null
        }
        try {
          controller.close()
        } catch {
          // ignored
        }
      }

      const resetIdleTimer = () => {
        if (idleTimer) {
          clearTimeout(idleTimer)
        }

        idleTimer = setTimeout(() => {
          markDialogStatus({
            agentId: input.agentId,
            provider: input.provider,
            status: 'error',
            lastError: 'agent_timeout_no_events',
          })
          send('error', {
            message: 'Agent did not return events in time. Check agent process/logs and provider credentials.',
          })
          close()
        }, STREAM_IDLE_TIMEOUT_MS)
      }

      send('status', {
        status: 'running',
        detail: 'Dispatching provider command…',
      })
      resetIdleTimer()

      if (currentState.providerSessionRef) {
        send('status', {
          status: 'resuming',
          detail: 'Trying to resume dialog context…',
        })
        resetIdleTimer()
      }

      const off = moduleBus.subscribe(topic, (event) => {
        resetIdleTimer()
        const busPayload = (event.payload ?? {}) as BusPayload
        const eventType = toText(busPayload.type)
        const payload = (busPayload.payload ?? {}) as Record<string, unknown>

        if (eventType === 'status') {
          const status = toText(payload.status) || 'running'
          markDialogStatus({
            agentId: input.agentId,
            provider: input.provider,
            status,
            lastError: null,
          })
          send('status', payload)
          return
        }

        if (eventType === 'assistant_chunk') {
          send('assistant_chunk', {
            text: toText(payload.text),
          })
          return
        }

        if (eventType === 'assistant_done') {
          const providerRef = toText(payload.providerRef) || currentState.providerSessionRef
          markDialogStatus({
            agentId: input.agentId,
            provider: input.provider,
            providerSessionRef: providerRef,
            status: 'done',
            lastError: null,
          })
          send('assistant_done', {
            providerRef,
            finishReason: toText(payload.finishReason),
          })
          off()
          close()
          return
        }

        if (eventType === 'resume_failed') {
          const reason = toText(payload.reason) || 'resume_failed'
          markDialogStatus({
            agentId: input.agentId,
            provider: input.provider,
            providerSessionRef: '',
            status: 'error',
            lastError: reason,
          })
          send('resume_failed', {
            reason,
          })
          return
        }

        if (eventType === 'error') {
          const message = toText(payload.message) || 'Unknown agent error.'
          markDialogStatus({
            agentId: input.agentId,
            provider: input.provider,
            status: 'error',
            lastError: message,
          })
          send('error', {
            message,
          })
          off()
          close()
        }
      })

      const accepted = passportRuntime.dispatchTerminalAgentSendMessage({
        agentId: onlineAgent.agentId,
        sessionId: onlineAgent.sessionId,
        dialogId,
        provider: input.provider,
        message: input.message,
        resumeRef: currentState.providerSessionRef || undefined,
        apiKey: providerSettings.apiKey,
        commandPath: providerSettings.commandPath,
        commandArgs: providerSettings.commandArgs,
        useShellFallback: settings.useShellFallback,
        shellOverride: settings.shellOverride || undefined,
      })

      if (!accepted) {
        off()
        markDialogStatus({
          agentId: input.agentId,
          provider: input.provider,
          status: 'error',
          lastError: 'agent_offline',
        })
        send('error', {
          message: 'agent_offline',
        })
        close()
        return
      }

      input.request.signal.addEventListener('abort', () => {
        off()
        close()
      })
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

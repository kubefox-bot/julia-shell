import { randomUUID } from 'node:crypto'
import { passportRuntime } from '@passport/server/runtime'
import { getTerminalAgentDialogState, getTerminalAgentSettings } from '../../../domains/llm/server/repository/terminal-agent-repository'
import { jsonResponse } from '@shared/lib/http'
import { HTTP_STATUS_OK, HTTP_STATUS_SERVICE_UNAVAILABLE } from '@shared/lib/http-status'
import { moduleBus } from '@shared/lib/module-bus'
import { WIDGET_ID } from './constants'
import { markDialogStatus } from './settings'
import type { TerminalAgentProvider } from '../../../domains/llm/server/repository/terminal-agent-repository'
import { toSseEvent } from './utils'
import { STREAM_IDLE_TIMEOUT_MS } from './message-stream.constants'
import { createBusEventHandler, createDialogTitle } from './message-stream.events'
import { getProviderDispatchConfig, selectDispatchSettings } from './message-stream.provider'

export async function handleTerminalAgentMessageStream(input: {
  request: Request
  agentId: string
  provider: TerminalAgentProvider
  message: string
}) {
  const onlineAgent = passportRuntime.getOnlineAgentSession(input.agentId)
  if (!onlineAgent) {
    return jsonResponse({ error: 'agent_offline' }, HTTP_STATUS_SERVICE_UNAVAILABLE)
  }

  const tokenSettings = getTerminalAgentSettings(input.agentId, WIDGET_ID)
  const settings = selectDispatchSettings({
    provider: input.provider,
    tokenSettings,
    onlineSettings: tokenSettings,
  })

  const currentState = getTerminalAgentDialogState(input.agentId, WIDGET_ID, input.provider)
  const dialogId = randomUUID()
  const topic = `agent:widget:${WIDGET_ID}:${dialogId}`
  const dialogTitle = createDialogTitle(input.message)
  const providerSettings = getProviderDispatchConfig(input.provider, settings)

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
      const flags = {
        quotaHintReported: false,
        quotaDetected: false,
        geminiApiKeyHintReported: false,
        geminiApiKeyDetected: false,
      }

      const send = (event: string, payload: Record<string, unknown>) => {
        if (!closed) {
          controller.enqueue(encoder.encode(toSseEvent(event, payload)))
        }
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

      send('status', { status: 'running', detail: 'Dispatching provider command…' })
      resetIdleTimer()

      if (currentState.providerSessionRef) {
        send('status', { status: 'resuming', detail: 'Trying to resume dialog context…' })
        resetIdleTimer()
      }


      const off = moduleBus.subscribe(topic, (event) => {
        resetIdleTimer()
        createBusEventHandler({
          agentId: input.agentId,
          provider: input.provider,
          currentState,
          dialogTitle,
          flags,
          send,
          close,
          off,
        })(event)
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
        send('error', { message: 'agent_offline' })
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
    status: HTTP_STATUS_OK,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

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
const DIALOG_TITLE_MAX = 120
const TOOL_DETAIL_MAX = 320
const GEMINI_QUOTA_MESSAGE = 'Gemini quota exceeded. Check billing/limits and retry later.'
const GEMINI_API_KEY_MISSING_MESSAGE = 'Gemini API key is missing. Set GEMINI_API_KEY and retry later.'

function toDialogTitle(message: string) {
  const compact = message.trim().replace(/\s+/g, ' ')
  if (!compact) {
    return ''
  }
  return compact.length > DIALOG_TITLE_MAX
    ? `${compact.slice(0, DIALOG_TITLE_MAX - 1)}…`
    : compact
}

function truncateDetail(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length <= TOOL_DETAIL_MAX) {
    return normalized
  }
  return `${normalized.slice(0, TOOL_DETAIL_MAX - 1)}…`
}

function isGeminiQuotaDetail(value: string) {
  const text = value.toLowerCase()
  return text.includes('quota exceeded')
    || text.includes('exhausted your daily quota')
    || text.includes('exceeded your current quota')
    || text.includes('terminalquotaerror')
    || text.includes('code: 429')
}

function isGeminiApiKeyMissingDetail(value: string) {
  const text = value.toLowerCase()
  return text.includes('must specify the gemini_api_key environment variable')
    || (
      text.includes('gemini_api_key')
      && text.includes('environment variable')
      && text.includes('must specify')
    )
}

function isGeminiApiKeyFollowupDetail(value: string) {
  const text = value.toLowerCase()
  return text.includes('update your environment and try again')
}

function shouldHideToolDetail(value: string) {
  const text = value.trim()
  if (!text) {
    return true
  }
  const lower = text.toLowerCase()
  return lower.startsWith('at ')
    || lower.includes('node:internal')
    || lower.includes('file:///')
    || lower.includes('googlequotaerrors.js')
    || lower.includes('geminichat.')
}

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

  const tokenSettings = getTerminalAgentSettings(input.agentId, WIDGET_ID)
  const onlineAgentSettings = onlineAgent.agentId === input.agentId
    ? tokenSettings
    : getTerminalAgentSettings(onlineAgent.agentId, WIDGET_ID)

  const tokenProviderKey = input.provider === 'codex'
    ? tokenSettings.codexApiKey
    : tokenSettings.geminiApiKey
  const onlineProviderKey = input.provider === 'codex'
    ? onlineAgentSettings.codexApiKey
    : onlineAgentSettings.geminiApiKey
  const settings = tokenProviderKey.trim()
    ? tokenSettings
    : onlineProviderKey.trim()
      ? onlineAgentSettings
      : tokenSettings

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
  const dialogTitle = toDialogTitle(input.message)

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      let idleTimer: ReturnType<typeof setTimeout> | null = null
      let quotaHintReported = false
      let quotaDetected = false
      let geminiApiKeyHintReported = false
      let geminiApiKeyDetected = false

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
          const rawDetail = toText(payload.detail)
          if (status === 'tool_call') {
            if (input.provider === 'gemini' && isGeminiApiKeyMissingDetail(rawDetail)) {
              geminiApiKeyDetected = true
              if (geminiApiKeyHintReported) {
                return
              }
              geminiApiKeyHintReported = true
              const missingApiKeyPayload = {
                status,
                detail: GEMINI_API_KEY_MISSING_MESSAGE,
              }
              markDialogStatus({
                agentId: input.agentId,
                provider: input.provider,
                status,
                lastError: null,
              })
              send('status', missingApiKeyPayload)
              return
            }
            if (input.provider === 'gemini' && geminiApiKeyDetected && isGeminiApiKeyFollowupDetail(rawDetail)) {
              return
            }
            if (isGeminiQuotaDetail(rawDetail)) {
              quotaDetected = true
              if (quotaHintReported) {
                return
              }
              quotaHintReported = true
              const quotaPayload = {
                status,
                detail: GEMINI_QUOTA_MESSAGE,
              }
              markDialogStatus({
                agentId: input.agentId,
                provider: input.provider,
                status,
                lastError: null,
              })
              send('status', quotaPayload)
              return
            }
            if (shouldHideToolDetail(rawDetail)) {
              return
            }
          }

          const normalizedPayload = status === 'tool_call'
            ? { ...payload, detail: truncateDetail(rawDetail) }
            : payload
          markDialogStatus({
            agentId: input.agentId,
            provider: input.provider,
            status,
            lastError: null,
          })
          send('status', normalizedPayload)
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
            dialogTitle: dialogTitle || currentState.dialogTitle,
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
          const rawMessage = toText(payload.message) || 'Unknown agent error.'
          const message = (quotaDetected || isGeminiQuotaDetail(rawMessage))
            ? GEMINI_QUOTA_MESSAGE
            : (input.provider === 'gemini' && (
                geminiApiKeyDetected
                || rawMessage.toLowerCase().includes('provider exited with code: 41')
              ))
              ? GEMINI_API_KEY_MISSING_MESSAGE
            : rawMessage
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

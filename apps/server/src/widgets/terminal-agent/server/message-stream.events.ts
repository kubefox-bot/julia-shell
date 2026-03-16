import { markDialogStatus } from './settings'
import type { BusPayload } from './message-stream.type'
import {
  GEMINI_API_KEY_MISSING_MESSAGE,
  GEMINI_QUOTA_MESSAGE,
  UNKNOWN_AGENT_ERROR_MESSAGE,
} from './message-stream.constants'
import { toText } from '@shared/utils'
import type { TerminalAgentProvider, TerminalAgentDialogState } from '../../../domains/llm/server/repository/terminal-agent-repository'
import {
  isGeminiApiKeyFollowupDetail,
  isGeminiApiKeyMissingDetail,
  isGeminiQuotaDetail,
  resolveStreamErrorMessage,
  shouldHideToolDetail,
  truncateToolDetail,
} from './message-stream.detail'

type StreamFlags = {
  quotaHintReported: boolean
  quotaDetected: boolean
  geminiApiKeyHintReported: boolean
  geminiApiKeyDetected: boolean
}

type StreamEventContext = {
  agentId: string
  provider: TerminalAgentProvider
  currentState: TerminalAgentDialogState
  dialogTitle: string
  flags: StreamFlags
  send: (event: string, payload: Record<string, unknown>) => void
  close: () => void
  off: () => void
}

function updateDialogStatus(input: {
  agentId: string
  provider: TerminalAgentProvider
  status: string
  lastError: string | null
  providerSessionRef?: string
  dialogTitle?: string
}) {
  markDialogStatus(input)
}

function handleToolCallStatus(input: {
  rawDetail: string
  status: string
  context: StreamEventContext
}) {
  const { rawDetail, status, context } = input

  const rules = [
    {
      when: () => context.provider === 'gemini' && isGeminiApiKeyMissingDetail(rawDetail),
      run: () => {
        context.flags.geminiApiKeyDetected = true
        if (context.flags.geminiApiKeyHintReported) {
          return true
        }
        context.flags.geminiApiKeyHintReported = true
        updateDialogStatus({ agentId: context.agentId, provider: context.provider, status, lastError: null })
        context.send('status', { status, detail: GEMINI_API_KEY_MISSING_MESSAGE })
        return true
      },
    },
    {
      when: () => context.provider === 'gemini' && context.flags.geminiApiKeyDetected && isGeminiApiKeyFollowupDetail(rawDetail),
      run: () => true,
    },
    {
      when: () => isGeminiQuotaDetail(rawDetail),
      run: () => {
        context.flags.quotaDetected = true
        if (context.flags.quotaHintReported) {
          return true
        }
        context.flags.quotaHintReported = true
        updateDialogStatus({ agentId: context.agentId, provider: context.provider, status, lastError: null })
        context.send('status', { status, detail: GEMINI_QUOTA_MESSAGE })
        return true
      },
    },
    {
      when: () => shouldHideToolDetail(rawDetail),
      run: () => true,
    },
  ] as const

  const matchedRule = rules.find((rule) => rule.when())
  return matchedRule?.run() ?? false
}

function handleStatusEvent(payload: Record<string, unknown>, context: StreamEventContext) {
  const status = toText(payload.status) || 'running'
  const rawDetail = toText(payload.detail)
  if (status === 'tool_call' && handleToolCallStatus({ rawDetail, status, context })) {
    return
  }

  const normalizedPayload = status === 'tool_call'
    ? { ...payload, detail: truncateToolDetail(rawDetail) }
    : payload

  updateDialogStatus({ agentId: context.agentId, provider: context.provider, status, lastError: null })
  context.send('status', normalizedPayload)
}

function handleAssistantDoneEvent(payload: Record<string, unknown>, context: StreamEventContext) {
  const providerRef = toText(payload.providerRef) || context.currentState.providerSessionRef
  updateDialogStatus({
    agentId: context.agentId,
    provider: context.provider,
    providerSessionRef: providerRef,
    dialogTitle: context.dialogTitle || context.currentState.dialogTitle,
    status: 'done',
    lastError: null,
  })
  context.send('assistant_done', {
    providerRef,
    finishReason: toText(payload.finishReason),
  })
  context.off()
  context.close()
}

function handleResumeFailedEvent(payload: Record<string, unknown>, context: StreamEventContext) {
  const reason = toText(payload.reason) || 'resume_failed'
  updateDialogStatus({
    agentId: context.agentId,
    provider: context.provider,
    providerSessionRef: '',
    status: 'error',
    lastError: reason,
  })
  context.send('resume_failed', { reason })
}

function resolveErrorMessage(rawMessage: string, context: StreamEventContext) {
  return resolveStreamErrorMessage({
    rawMessage,
    provider: context.provider,
    quotaDetected: context.flags.quotaDetected,
    geminiApiKeyDetected: context.flags.geminiApiKeyDetected,
  })
}

function handleErrorEvent(payload: Record<string, unknown>, context: StreamEventContext) {
  const rawMessage = toText(payload.message) || UNKNOWN_AGENT_ERROR_MESSAGE
  const message = resolveErrorMessage(rawMessage, context)
  updateDialogStatus({
    agentId: context.agentId,
    provider: context.provider,
    status: 'error',
    lastError: message,
  })
  context.send('error', { message })
  context.off()
  context.close()
}

export { createDialogTitle } from './message-stream.detail'

export function createBusEventHandler(context: StreamEventContext) {
  return (event: { payload?: unknown }) => {
    const busPayload = (event.payload ?? {}) as BusPayload
    const eventType = toText(busPayload.type)
    const payload = (busPayload.payload ?? {}) as Record<string, unknown>

    if (eventType === 'status') {
      handleStatusEvent(payload, context)
      return
    }

    if (eventType === 'assistant_chunk') {
      context.send('assistant_chunk', { text: toText(payload.text) })
      return
    }

    if (eventType === 'assistant_done') {
      handleAssistantDoneEvent(payload, context)
      return
    }

    if (eventType === 'resume_failed') {
      handleResumeFailedEvent(payload, context)
      return
    }

    if (eventType === 'error') {
      handleErrorEvent(payload, context)
    }
  }
}

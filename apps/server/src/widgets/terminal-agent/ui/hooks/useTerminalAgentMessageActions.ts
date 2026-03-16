import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { openTerminalAgentMessageStream } from '../terminal-agent.api'
import { createMessageId, readTerminalAgentStream } from '../terminal-agent.stream'
import type { DialogStatePayload, MessageItem, RetryState, SettingsPayload } from '../terminal-agent.types'
import { appendChunkWithSpacing, normalizeForCompare } from '../terminal-agent.utils'

type SendMessageOptions = {
  message?: string
  appendUser?: boolean
  userMessageId?: string
}

type Input = {
  input: string
  sending: boolean
  settings: SettingsPayload | null
  setInput: (value: string) => void
  setSending: (value: boolean) => void
  setError: (value: string | null) => void
  setResumeFailed: (value: boolean) => void
  setRetryState: (value: RetryState | null) => void
  setStatusLine: (value: string) => void
  setDialogState: Dispatch<SetStateAction<DialogStatePayload | null>>
  setMessages: Dispatch<SetStateAction<MessageItem[]>>
}

function appendPendingMessages(input: Input, message: string, appendUser: boolean, userMessageId: string, assistantMessageId: string) {
  input.setMessages((prev) => {
    const next = appendUser ? [...prev, { id: userMessageId, role: 'user' as const, text: message }] : [...prev]
    next.push({ id: assistantMessageId, role: 'assistant' as const, text: '' })
    return next
  })
}

function removePendingAssistant(input: Input, assistantMessageId: string) {
  input.setMessages((prev) => prev.filter((entry) => entry.id !== assistantMessageId))
}

function createStreamHandlers(input: Input, assistantMessageId: string, message: string) {
  return {
    onStatus: input.setStatusLine,
    onAssistantChunk: (text: string) => {
      input.setMessages((prev) => prev.map((entry) => {
        if (entry.id !== assistantMessageId) {
          return entry
        }
        if (!entry.text && normalizeForCompare(text) === normalizeForCompare(message)) {
          return entry
        }
        return { ...entry, text: appendChunkWithSpacing(entry.text, text) }
      }))
    },
    onAssistantDone: (providerRef: string) => {
      input.setDialogState((prev) => prev ? {
        ...prev,
        providerSessionRef: providerRef || prev.providerSessionRef,
        dialogTitle: prev.dialogTitle || message,
        status: 'done',
        lastError: null,
      } : prev)
      input.setStatusLine('done')
    },
    onResumeFailed: (reason: string) => {
      input.setResumeFailed(true)
      input.setError(reason)
      input.setStatusLine('error')
    },
  }
}

function resetSendState(input: Input, appendUser: boolean) {
  input.setSending(true)
  input.setError(null)
  input.setResumeFailed(false)
  input.setRetryState(null)
  if (appendUser) {
    input.setInput('')
  }
}

export function useTerminalAgentMessageActions(input: Input) {
  return useCallback(async (options?: SendMessageOptions) => {
    const message = (options?.message ?? input.input).trim()
    if (!message || !input.settings || input.sending) {
      return
    }

    const appendUser = options?.appendUser ?? true
    const userMessageId = options?.userMessageId ?? createMessageId('user')
    const assistantMessageId = createMessageId('assistant')
    resetSendState(input, appendUser)
    appendPendingMessages(input, message, appendUser, userMessageId, assistantMessageId)

    try {
      const response = await openTerminalAgentMessageStream(input.settings.activeProvider, message)
      const gotAssistantChunk = await readTerminalAgentStream(
        response,
        createStreamHandlers(input, assistantMessageId, message),
      )

      if (!gotAssistantChunk) {
        removePendingAssistant(input, assistantMessageId)
        input.setRetryState({ message, userMessageId })
        input.setStatusLine('error')
      }
    } catch (sendError) {
      removePendingAssistant(input, assistantMessageId)
      input.setRetryState({ message, userMessageId })
      input.setError(sendError instanceof Error ? sendError.message : 'Message failed.')
      input.setStatusLine('error')
    } finally {
      input.setSending(false)
    }
  }, [input])
}

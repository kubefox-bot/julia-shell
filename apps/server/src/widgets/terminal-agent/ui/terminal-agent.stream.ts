import { DateTime } from 'luxon'
import { parseSseEventChunk } from './terminal-agent.utils'
import { toText } from '@shared/utils'

const UUID_FALLBACK_RADIX = 36
const STREAM_CHUNK_DELIMITER = '\n\n'

type StreamHandlers = {
  onStatus: (status: string) => void
  onAssistantChunk: (text: string) => void
  onAssistantDone: (providerRef: string) => void
  onResumeFailed: (reason: string) => void
}

type StreamState = {
  gotAssistantChunk: boolean
}

function createFallbackId(role: 'user' | 'assistant') {
  return `${DateTime.utc().toMillis().toString(UUID_FALLBACK_RADIX)}-${role}`
}

function handleParsedStreamEvent(parsed: { eventName: string; payload: Record<string, unknown> }, handlers: StreamHandlers, state: StreamState) {
  if (parsed.eventName === 'status') {
    handlers.onStatus(toText(parsed.payload.status) || 'running')
    return
  }

  if (parsed.eventName === 'assistant_chunk') {
    const text = toText(parsed.payload.text)
    if (!text) {
      return
    }
    state.gotAssistantChunk = true
    handlers.onAssistantChunk(text)
    return
  }

  if (parsed.eventName === 'assistant_done') {
    handlers.onAssistantDone(toText(parsed.payload.providerRef))
    return
  }

  if (parsed.eventName === 'resume_failed') {
    handlers.onResumeFailed(toText(parsed.payload.reason) || 'resume_failed')
    return
  }

  if (parsed.eventName === 'error') {
    throw new Error(toText(parsed.payload.message) || 'Agent error.')
  }
}

function consumeBufferedEvents(buffer: string, handlers: StreamHandlers, state: StreamState) {
  let nextBuffer = buffer

  while (true) {
    const boundary = nextBuffer.indexOf(STREAM_CHUNK_DELIMITER)
    if (boundary === -1) {
      return nextBuffer
    }

    const chunk = nextBuffer.slice(0, boundary)
    nextBuffer = nextBuffer.slice(boundary + STREAM_CHUNK_DELIMITER.length)
    const parsedResult = parseSseEventChunk(chunk)
    if (parsedResult.isOk()) {
      handleParsedStreamEvent(parsedResult.unwrap(), handlers, state)
    }
  }
}

async function resolveStreamReader(response: Response) {
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    throw new Error(toText(payload?.error) || 'Message stream failed.')
  }

  return response.body.getReader()
}

export function createMessageId(role: 'user' | 'assistant') {
  const randomId = globalThis.crypto?.randomUUID()
  return randomId ? `${randomId}-${role}` : createFallbackId(role)
}

export async function readTerminalAgentStream(response: Response, handlers: StreamHandlers) {
  const reader = await resolveStreamReader(response)
  const decoder = new TextDecoder()
  const state: StreamState = { gotAssistantChunk: false }
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      return state.gotAssistantChunk
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
    buffer = consumeBufferedEvents(buffer, handlers, state)
  }
}

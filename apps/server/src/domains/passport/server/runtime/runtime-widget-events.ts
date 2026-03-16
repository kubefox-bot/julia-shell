import { TERMINAL_AGENT_WIDGET_ID, TRANSCRIBE_WIDGET_ID } from '@/widgets'
import type { RuntimeEnvelope } from './runtime-types'

export type RuntimeWidgetEvent = {
  widgetId: string
  eventType: string
  payload: unknown
}

const LEGACY_TRANSCRIBE_EVENTS = [
  { key: 'progress', eventType: 'progress' },
  { key: 'token', eventType: 'token' },
  { key: 'done', eventType: 'done' },
  { key: 'error', eventType: 'error' }
] as const

const WIDGET_EVENT_FIELDS = [
  { key: 'transcribeProgress', eventType: 'progress' },
  { key: 'transcribeToken', eventType: 'token' },
  { key: 'transcribeDone', eventType: 'done' },
  { key: 'transcribeError', eventType: 'error' },
  { key: 'terminalAgentStatus', eventType: 'status' },
  { key: 'terminalAgentAssistantChunk', eventType: 'assistant_chunk' },
  { key: 'terminalAgentAssistantDone', eventType: 'assistant_done' },
  { key: 'terminalAgentResumeFailed', eventType: 'resume_failed' },
  { key: 'terminalAgentError', eventType: 'error' }
] as const

function resolveLegacyTranscribeEvent(envelope: RuntimeEnvelope): RuntimeWidgetEvent | null {
  for (const field of LEGACY_TRANSCRIBE_EVENTS) {
    const payload = envelope[field.key]
    if (payload) {
      return {
        widgetId: TRANSCRIBE_WIDGET_ID,
        eventType: field.eventType,
        payload
      }
    }
  }

  return null
}

function resolveWidgetEventId(widgetEvent: Record<string, unknown>) {
  if (typeof widgetEvent.widgetId === 'string') {
    return widgetEvent.widgetId.trim()
  }

  if (typeof widgetEvent.widget_id === 'string') {
    return widgetEvent.widget_id.trim()
  }

  return null
}

function resolveTypedWidgetEvent(widgetEvent: Record<string, unknown>, widgetId: string): RuntimeWidgetEvent | null {
  for (const field of WIDGET_EVENT_FIELDS) {
    const payload = widgetEvent[field.key]
    if (payload) {
      return {
        widgetId,
        eventType: field.eventType,
        payload
      }
    }
  }

  return null
}

export function resolveWidgetEvent(envelope: RuntimeEnvelope): RuntimeWidgetEvent | null {
  const legacyEvent = resolveLegacyTranscribeEvent(envelope)
  if (legacyEvent) {
    return legacyEvent
  }

  const widgetEvent = typeof envelope.widgetEvent === 'object' && envelope.widgetEvent !== null
    ? envelope.widgetEvent as Record<string, unknown>
    : null

  if (!widgetEvent) {
    return null
  }

  const widgetId = resolveWidgetEventId(widgetEvent)
  if (!widgetId) {
    return null
  }

  const resolved = resolveTypedWidgetEvent(widgetEvent, widgetId)
  if (!resolved) {
    return null
  }

  if (resolved.widgetId === TRANSCRIBE_WIDGET_ID || resolved.widgetId === TERMINAL_AGENT_WIDGET_ID) {
    return resolved
  }

  return resolved
}


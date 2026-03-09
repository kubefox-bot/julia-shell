import path from 'node:path'
import {
  appendTranscribeOutboxEvent,
  completeTranscribeJob,
  failTranscribeJob,
  updateTranscribeJobProgress,
} from './repository'
import { WIDGET_ID } from './constants'

export type AgentEventPayload = {
  type?: string
  payload?: Record<string, unknown>
}

export type AgentStreamHandlers = {
  send: (event: string, payload: Record<string, unknown>) => void
  close: () => void
  off: () => void
}

export type AgentStreamContext = {
  eventPayload: AgentEventPayload
  handlers: AgentStreamHandlers
  agentId: string
  jobId: string
  canonicalSourceFile: string
  resolvedFolderPath: string
}

function handleProgressEvent(context: AgentStreamContext) {
  const percent = Number(context.eventPayload.payload?.percent ?? 0)
  const stage = String(context.eventPayload.payload?.stage ?? 'progress')
  updateTranscribeJobProgress(context.jobId, percent)
  context.handlers.send('progress', { percent, stage, jobId: context.jobId })
}

function handleTokenEvent(context: AgentStreamContext) {
  const text = String(context.eventPayload.payload?.text ?? '')
  if (text) {
    context.handlers.send('token', { text, jobId: context.jobId, model: 'agent' })
  }
}

function handleDoneEvent(context: AgentStreamContext) {
  const transcript = String(context.eventPayload.payload?.transcript ?? '')
  const savePath = String(
    context.eventPayload.payload?.savePath ??
      path.join(context.resolvedFolderPath, `${path.parse(context.canonicalSourceFile).name}.txt`)
  )

  completeTranscribeJob(context.jobId, savePath)
  appendTranscribeOutboxEvent({
    agentId: context.agentId,
    widgetId: WIDGET_ID,
    jobId: context.jobId,
    eventType: 'transcription_completed',
    state: 'completed',
    payload: {
      sourceFile: context.canonicalSourceFile,
      savePath,
      model: 'agent',
    },
  })

  context.handlers.send('done', {
    status: 'ready',
    sourceFile: context.canonicalSourceFile,
    savePath,
    transcript,
    model: 'agent',
    jobId: context.jobId,
  })
  context.handlers.off()
  context.handlers.close()
}

function handleErrorEvent(context: AgentStreamContext) {
  const message = String(context.eventPayload.payload?.message ?? 'Agent transcription failed.')
  failTranscribeJob(context.jobId, message)
  appendTranscribeOutboxEvent({
    agentId: context.agentId,
    widgetId: WIDGET_ID,
    jobId: context.jobId,
    eventType: 'job_failed',
    state: 'failed',
    payload: { message },
  })
  context.handlers.send('error', { message, jobId: context.jobId })
  context.handlers.off()
  context.handlers.close()
}

export function handleAgentBusEvent(context: AgentStreamContext) {
  const eventType = context.eventPayload.type ?? ''
  switch (eventType) {
    case 'progress':
      handleProgressEvent(context)
      return
    case 'token':
      handleTokenEvent(context)
      return
    case 'done':
      handleDoneEvent(context)
      return
    case 'error':
      handleErrorEvent(context)
      return
    default:
      return
  }
}

import { nowMillis } from '@shared/lib/time'
import { TERMINAL_AGENT_WIDGET_ID, TRANSCRIBE_WIDGET_ID } from '@/widgets'
import type { AgentConnection } from './runtime-types'
import { PROTOCOL_VERSION } from './runtime-constants'

type RuntimeDispatchCommand =
  | {
      kind: 'transcribe_start'
      folderPath: string
      filePaths: string[]
    }
  | {
      kind: 'transcribe_cancel'
      reason?: string
    }
  | {
      kind: 'terminal_agent_send_message'
      provider: 'codex' | 'gemini'
      message: string
      resumeRef?: string
      apiKey?: string
      commandPath: string
      commandArgs: string[]
      useShellFallback: boolean
      shellOverride?: string
    }
  | {
      kind: 'terminal_agent_reset_dialog'
      reason?: string
    }

export type RuntimeDispatchInput = {
  agentId: string
  sessionId: string
  jobId: string
  widgetId: string
  command: RuntimeDispatchCommand
}

export function dispatchWidgetCommandFromConnections(
  connections: Map<string, AgentConnection>,
  input: RuntimeDispatchInput
) {
  const connection = connections.get(input.agentId)
  if (!connection) {
    return false
  }

  let payload: Record<string, unknown>
  if (input.command.kind === 'transcribe_start') {
    payload = {
      transcribeStart: {
        folderPath: input.command.folderPath,
        filePaths: input.command.filePaths,
      },
    }
  } else if (input.command.kind === 'transcribe_cancel') {
    payload = {
      transcribeCancel: {
        reason: input.command.reason ?? '',
      },
    }
  } else if (input.command.kind === 'terminal_agent_send_message') {
    payload = {
      terminalAgentSendMessage: {
        provider: input.command.provider === 'codex' ? 1 : 2,
        message: input.command.message,
        resumeRef: input.command.resumeRef ?? '',
        apiKey: input.command.apiKey ?? '',
        commandPath: input.command.commandPath,
        commandArgs: input.command.commandArgs,
        useShellFallback: input.command.useShellFallback,
        shellOverride: input.command.shellOverride ?? '',
      },
    }
  } else {
    payload = {
      terminalAgentResetDialog: {
        reason: input.command.reason ?? '',
      },
    }
  }

  const baseEnvelope = {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: input.sessionId,
    jobId: input.jobId,
    timestampUnixMs: nowMillis(),
  }

  if (input.command.kind === 'transcribe_start') {
    connection.call.write({
      ...baseEnvelope,
      transcribeStart: {
        folderPath: input.command.folderPath,
        filePaths: input.command.filePaths,
      },
    })
    return true
  }

  if (input.command.kind === 'transcribe_cancel') {
    connection.call.write({
      ...baseEnvelope,
      transcribeCancel: {
        reason: input.command.reason ?? '',
      },
    })
    return true
  }

  connection.call.write({
    ...baseEnvelope,
    widgetCommand: {
      widgetId: input.widgetId,
      ...payload,
    },
  })

  return true
}

export function buildTranscribeStartDispatch(input: {
  agentId: string
  sessionId: string
  jobId: string
  folderPath: string
  filePaths: string[]
}): RuntimeDispatchInput {
  return {
    agentId: input.agentId,
    sessionId: input.sessionId,
    jobId: input.jobId,
    widgetId: TRANSCRIBE_WIDGET_ID,
    command: {
      kind: 'transcribe_start',
      folderPath: input.folderPath,
      filePaths: input.filePaths,
    },
  }
}

export function buildTerminalAgentSendMessageDispatch(input: {
  agentId: string
  sessionId: string
  dialogId: string
  provider: 'codex' | 'gemini'
  message: string
  resumeRef?: string
  apiKey?: string
  commandPath: string
  commandArgs: string[]
  useShellFallback: boolean
  shellOverride?: string
}): RuntimeDispatchInput {
  return {
    agentId: input.agentId,
    sessionId: input.sessionId,
    jobId: input.dialogId,
    widgetId: TERMINAL_AGENT_WIDGET_ID,
    command: {
      kind: 'terminal_agent_send_message',
      provider: input.provider,
      message: input.message,
      resumeRef: input.resumeRef,
      apiKey: input.apiKey,
      commandPath: input.commandPath,
      commandArgs: input.commandArgs,
      useShellFallback: input.useShellFallback,
      shellOverride: input.shellOverride,
    },
  }
}

export function buildTerminalAgentResetDialogDispatch(input: {
  agentId: string
  sessionId: string
  dialogId: string
  reason?: string
}): RuntimeDispatchInput {
  return {
    agentId: input.agentId,
    sessionId: input.sessionId,
    jobId: input.dialogId,
    widgetId: TERMINAL_AGENT_WIDGET_ID,
    command: {
      kind: 'terminal_agent_reset_dialog',
      reason: input.reason,
    },
  }
}

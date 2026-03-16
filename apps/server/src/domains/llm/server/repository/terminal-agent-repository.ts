import {
  clearLlmRuntimeDialogState,
  getLlmRuntimeDialogState,
  getLlmRuntimeSettings,
  listLlmRuntimeDialogRefs,
  type LlmRuntimeProvider,
  upsertLlmRuntimeDialogRef,
  upsertLlmRuntimeDialogState,
  upsertLlmRuntimeSettings,
} from './runtime-repository'
import type { Result } from 'neverthrow'

export type TerminalAgentProvider = LlmRuntimeProvider

export type TerminalAgentSettings = {
  agentId: string
  widgetId: string
  activeProvider: TerminalAgentProvider
  codexApiKey: string
  geminiApiKey: string
  codexCommand: string
  codexArgs: string[]
  codexModel: string
  geminiCommand: string
  geminiArgs: string[]
  geminiModel: string
  useShellFallback: boolean
  shellOverride: string
  updatedAt: string | null
}

export type TerminalAgentDialogState = {
  agentId: string
  widgetId: string
  provider: TerminalAgentProvider
  providerSessionRef: string
  dialogTitle: string
  status: string
  lastError: string | null
  updatedAt: string | null
}

export type TerminalAgentDialogRef = {
  agentId: string
  widgetId: string
  provider: TerminalAgentProvider
  providerSessionRef: string
  dialogTitle: string
  createdAt: string
  updatedAt: string
  lastStatus: string
}

const DEFAULTS = {
  codexCommand: 'codex',
  codexArgs: [] as string[],
  codexModel: 'gpt-5-codex',
  geminiCommand: 'gemini',
  geminiArgs: ['--output-format', 'stream-json'],
  geminiModel: 'gemini-2.5-flash',
}

function unwrapOrThrow<T, E extends { message: string }>(value: Result<T, E>): T {
  if (value.isErr()) {
    throw new Error(value.error.message)
  }
  return value.value
}

export function getTerminalAgentSettings(agentId: string, widgetId: string): TerminalAgentSettings {
  const settings = unwrapOrThrow(getLlmRuntimeSettings({
    agentId,
    consumer: widgetId,
    defaults: DEFAULTS,
  }))

  return {
    ...settings,
    widgetId,
  }
}

export function saveTerminalAgentSettings(input: {
  agentId: string
  widgetId: string
  activeProvider: TerminalAgentProvider
  codexApiKey: string
  geminiApiKey: string
  codexCommand: string
  codexArgs: string[]
  codexModel: string
  geminiCommand: string
  geminiArgs: string[]
  geminiModel: string
  useShellFallback: boolean
  shellOverride?: string
}) {
  unwrapOrThrow(upsertLlmRuntimeSettings({
    agentId: input.agentId,
    consumer: input.widgetId,
    value: {
      activeProvider: input.activeProvider,
      codexApiKey: input.codexApiKey,
      geminiApiKey: input.geminiApiKey,
      codexCommand: input.codexCommand,
      codexArgs: input.codexArgs,
      codexModel: input.codexModel,
      geminiCommand: input.geminiCommand,
      geminiArgs: input.geminiArgs,
      geminiModel: input.geminiModel,
      useShellFallback: input.useShellFallback,
      shellOverride: input.shellOverride ?? '',
    },
  }))

  return getTerminalAgentSettings(input.agentId, input.widgetId)
}

export function getTerminalAgentDialogState(
  agentId: string,
  widgetId: string,
  provider: TerminalAgentProvider
): TerminalAgentDialogState {
  const row = unwrapOrThrow(getLlmRuntimeDialogState({
    agentId,
    consumer: widgetId,
    provider,
  }))

  return {
    ...row,
    widgetId,
  }
}

export function upsertTerminalAgentDialogState(input: {
  agentId: string
  widgetId: string
  provider: TerminalAgentProvider
  providerSessionRef?: string
  dialogTitle?: string
  status: string
  lastError?: string | null
}) {
  const current = getTerminalAgentDialogState(input.agentId, input.widgetId, input.provider)
  unwrapOrThrow(upsertLlmRuntimeDialogState({
    agentId: input.agentId,
    consumer: input.widgetId,
    provider: input.provider,
    providerSessionRef: input.providerSessionRef ?? current.providerSessionRef,
    dialogTitle: input.dialogTitle ?? current.dialogTitle,
    status: input.status,
    lastError: typeof input.lastError === 'undefined' ? current.lastError : input.lastError,
  }))

  return getTerminalAgentDialogState(input.agentId, input.widgetId, input.provider)
}

export function clearTerminalAgentDialogState(
  agentId: string,
  widgetId: string,
  provider: TerminalAgentProvider
) {
  unwrapOrThrow(clearLlmRuntimeDialogState({
    agentId,
    consumer: widgetId,
    provider,
  }))
}

export function upsertTerminalAgentDialogRef(input: {
  agentId: string
  widgetId: string
  provider: TerminalAgentProvider
  providerSessionRef: string
  dialogTitle?: string
  lastStatus?: string
}) {
  unwrapOrThrow(upsertLlmRuntimeDialogRef({
    agentId: input.agentId,
    consumer: input.widgetId,
    provider: input.provider,
    providerSessionRef: input.providerSessionRef,
    dialogTitle: input.dialogTitle,
    lastStatus: input.lastStatus ?? 'done',
  }))

  return input.providerSessionRef
}

export function listTerminalAgentDialogRefs(
  agentId: string,
  widgetId: string,
  provider: TerminalAgentProvider
): TerminalAgentDialogRef[] {
  const rows = unwrapOrThrow(listLlmRuntimeDialogRefs({
    agentId,
    consumer: widgetId,
    provider,
  }))

  return rows.map((row) => ({
    ...row,
    widgetId,
  }))
}

import { nowIso } from '@shared/lib/time'
import { and, desc, eq } from 'drizzle-orm'
import { err, ok, type Result } from 'neverthrow'
import { z } from 'zod'
import { openLlmRuntimeDatabase } from './runtime-drizzle'
import { llmConsumerDialogRefsTable, llmConsumerDialogStateTable, llmConsumerSettingsTable } from './runtime-schema'

export type LlmRuntimeProvider = 'codex' | 'gemini'

export type LlmRuntimeError = {
  code: 'db_error' | 'validation_error'
  message: string
}

const providerSchema = z.enum(['codex', 'gemini'])
const argsSchema = z.array(z.string())

export type LlmRuntimeSettings = {
  agentId: string
  consumer: string
  activeProvider: LlmRuntimeProvider
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

export type LlmRuntimeDialogState = {
  agentId: string
  consumer: string
  provider: LlmRuntimeProvider
  providerSessionRef: string
  dialogTitle: string
  status: string
  lastError: string | null
  updatedAt: string | null
}

export type LlmRuntimeDialogRef = {
  agentId: string
  consumer: string
  provider: LlmRuntimeProvider
  providerSessionRef: string
  dialogTitle: string
  createdAt: string
  updatedAt: string
  lastStatus: string
}

function toProvider(value: unknown, fallback: LlmRuntimeProvider = 'codex'): LlmRuntimeProvider {
  const parsed = providerSchema.safeParse(value)
  return parsed.success ? parsed.data : fallback
}

function toArgs(raw: unknown, fallback: string[]) {
  const parsed = argsSchema.safeParse(raw)
  if (!parsed.success) {
    return fallback
  }
  const normalized = parsed.data.map((item) => item.trim()).filter(Boolean)
  return normalized.length > 0 ? normalized : fallback
}

function parseArgs(raw: string, fallback: string[]) {
  try {
    return toArgs(JSON.parse(raw), fallback)
  } catch {
    return fallback
  }
}

function toText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getLlmRuntimeSettings(input: {
  agentId: string
  consumer: string
  defaults: {
    codexCommand: string
    codexArgs: string[]
    codexModel: string
    geminiCommand: string
    geminiArgs: string[]
    geminiModel: string
  }
}): Result<LlmRuntimeSettings, LlmRuntimeError> {
  try {
    const db = openLlmRuntimeDatabase()
    const row = db
      .select()
      .from(llmConsumerSettingsTable)
      .where(and(
        eq(llmConsumerSettingsTable.agentId, input.agentId),
        eq(llmConsumerSettingsTable.consumer, input.consumer),
      ))
      .get()

    return ok({
      agentId: input.agentId,
      consumer: input.consumer,
      activeProvider: toProvider(row?.activeProvider, 'codex'),
      codexApiKey: toText(row?.codexApiKey),
      geminiApiKey: toText(row?.geminiApiKey),
      codexCommand: toText(row?.codexCommand) || input.defaults.codexCommand,
      codexArgs: parseArgs(row?.codexArgsJson ?? '[]', input.defaults.codexArgs),
      codexModel: toText(row?.codexModel) || input.defaults.codexModel,
      geminiCommand: toText(row?.geminiCommand) || input.defaults.geminiCommand,
      geminiArgs: parseArgs(row?.geminiArgsJson ?? '[]', input.defaults.geminiArgs),
      geminiModel: toText(row?.geminiModel) || input.defaults.geminiModel,
      useShellFallback: Boolean(row?.useShellFallback),
      shellOverride: toText(row?.shellOverride),
      updatedAt: row?.updatedAt ?? null,
    })
  } catch (error) {
    return err({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to read llm runtime settings.',
    })
  }
}

export function upsertLlmRuntimeSettings(input: {
  agentId: string
  consumer: string
  value: Omit<LlmRuntimeSettings, 'updatedAt' | 'agentId' | 'consumer'>
}): Result<void, LlmRuntimeError> {
  try {
    const db = openLlmRuntimeDatabase()
    db
      .insert(llmConsumerSettingsTable)
      .values({
        agentId: input.agentId,
        consumer: input.consumer,
        activeProvider: input.value.activeProvider,
        codexApiKey: toText(input.value.codexApiKey),
        geminiApiKey: toText(input.value.geminiApiKey),
        codexCommand: toText(input.value.codexCommand),
        codexArgsJson: JSON.stringify(toArgs(input.value.codexArgs, [])),
        codexModel: toText(input.value.codexModel),
        geminiCommand: toText(input.value.geminiCommand),
        geminiArgsJson: JSON.stringify(toArgs(input.value.geminiArgs, [])),
        geminiModel: toText(input.value.geminiModel),
        useShellFallback: Boolean(input.value.useShellFallback),
        shellOverride: toText(input.value.shellOverride),
        updatedAt: nowIso(),
      })
      .onConflictDoUpdate({
        target: [llmConsumerSettingsTable.agentId, llmConsumerSettingsTable.consumer],
        set: {
          activeProvider: input.value.activeProvider,
          codexApiKey: toText(input.value.codexApiKey),
          geminiApiKey: toText(input.value.geminiApiKey),
          codexCommand: toText(input.value.codexCommand),
          codexArgsJson: JSON.stringify(toArgs(input.value.codexArgs, [])),
          codexModel: toText(input.value.codexModel),
          geminiCommand: toText(input.value.geminiCommand),
          geminiArgsJson: JSON.stringify(toArgs(input.value.geminiArgs, [])),
          geminiModel: toText(input.value.geminiModel),
          useShellFallback: Boolean(input.value.useShellFallback),
          shellOverride: toText(input.value.shellOverride),
          updatedAt: nowIso(),
        },
      })
      .run()

    return ok(undefined)
  } catch (error) {
    return err({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to write llm runtime settings.',
    })
  }
}

export function getLlmRuntimeDialogState(input: {
  agentId: string
  consumer: string
  provider: LlmRuntimeProvider
}): Result<LlmRuntimeDialogState, LlmRuntimeError> {
  try {
    const db = openLlmRuntimeDatabase()
    const row = db
      .select()
      .from(llmConsumerDialogStateTable)
      .where(and(
        eq(llmConsumerDialogStateTable.agentId, input.agentId),
        eq(llmConsumerDialogStateTable.consumer, input.consumer),
        eq(llmConsumerDialogStateTable.provider, input.provider),
      ))
      .get()

    return ok({
      agentId: input.agentId,
      consumer: input.consumer,
      provider: input.provider,
      providerSessionRef: toText(row?.providerSessionRef),
      dialogTitle: toText(row?.dialogTitle),
      status: toText(row?.status) || 'idle',
      lastError: row?.lastError ?? null,
      updatedAt: row?.updatedAt ?? null,
    })
  } catch (error) {
    return err({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to read llm runtime dialog state.',
    })
  }
}

export function upsertLlmRuntimeDialogState(input: {
  agentId: string
  consumer: string
  provider: LlmRuntimeProvider
  providerSessionRef: string
  dialogTitle?: string
  status: string
  lastError: string | null
}): Result<void, LlmRuntimeError> {
  try {
    const db = openLlmRuntimeDatabase()
    const existing = db
      .select()
      .from(llmConsumerDialogStateTable)
      .where(and(
        eq(llmConsumerDialogStateTable.agentId, input.agentId),
        eq(llmConsumerDialogStateTable.consumer, input.consumer),
        eq(llmConsumerDialogStateTable.provider, input.provider),
      ))
      .get()
    const dialogTitle = typeof input.dialogTitle === 'string'
      ? toText(input.dialogTitle)
      : toText(existing?.dialogTitle)

    db
      .insert(llmConsumerDialogStateTable)
      .values({
        agentId: input.agentId,
        consumer: input.consumer,
        provider: input.provider,
        providerSessionRef: toText(input.providerSessionRef),
        dialogTitle,
        status: toText(input.status) || 'idle',
        lastError: input.lastError,
        updatedAt: nowIso(),
      })
      .onConflictDoUpdate({
        target: [
          llmConsumerDialogStateTable.agentId,
          llmConsumerDialogStateTable.consumer,
          llmConsumerDialogStateTable.provider,
        ],
        set: {
          providerSessionRef: toText(input.providerSessionRef),
          dialogTitle,
          status: toText(input.status) || 'idle',
          lastError: input.lastError,
          updatedAt: nowIso(),
        },
      })
      .run()

    return ok(undefined)
  } catch (error) {
    return err({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to write llm runtime dialog state.',
    })
  }
}

export function clearLlmRuntimeDialogState(input: {
  agentId: string
  consumer: string
  provider: LlmRuntimeProvider
}): Result<void, LlmRuntimeError> {
  return upsertLlmRuntimeDialogState({
    agentId: input.agentId,
    consumer: input.consumer,
    provider: input.provider,
    providerSessionRef: '',
    dialogTitle: '',
    status: 'idle',
    lastError: null,
  })
}

export function upsertLlmRuntimeDialogRef(input: {
  agentId: string
  consumer: string
  provider: LlmRuntimeProvider
  providerSessionRef: string
  dialogTitle?: string
  lastStatus: string
}): Result<void, LlmRuntimeError> {
  try {
    const providerSessionRef = toText(input.providerSessionRef)
    if (!providerSessionRef) {
      return ok(undefined)
    }
    const db = openLlmRuntimeDatabase()
    const existing = db
      .select()
      .from(llmConsumerDialogRefsTable)
      .where(and(
        eq(llmConsumerDialogRefsTable.agentId, input.agentId),
        eq(llmConsumerDialogRefsTable.consumer, input.consumer),
        eq(llmConsumerDialogRefsTable.provider, input.provider),
        eq(llmConsumerDialogRefsTable.providerSessionRef, providerSessionRef),
      ))
      .get()
    const dialogTitle = typeof input.dialogTitle === 'string'
      ? toText(input.dialogTitle)
      : toText(existing?.dialogTitle)
    const now = nowIso()
    db
      .insert(llmConsumerDialogRefsTable)
      .values({
        agentId: input.agentId,
        consumer: input.consumer,
        provider: input.provider,
        providerSessionRef,
        dialogTitle,
        createdAt: now,
        updatedAt: now,
        lastStatus: toText(input.lastStatus) || 'done',
      })
      .onConflictDoUpdate({
        target: [
          llmConsumerDialogRefsTable.agentId,
          llmConsumerDialogRefsTable.consumer,
          llmConsumerDialogRefsTable.provider,
          llmConsumerDialogRefsTable.providerSessionRef,
        ],
        set: {
          dialogTitle,
          updatedAt: now,
          lastStatus: toText(input.lastStatus) || 'done',
        },
      })
      .run()

    return ok(undefined)
  } catch (error) {
    return err({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to write llm runtime dialog refs.',
    })
  }
}

export function listLlmRuntimeDialogRefs(input: {
  agentId: string
  consumer: string
  provider: LlmRuntimeProvider
}): Result<LlmRuntimeDialogRef[], LlmRuntimeError> {
  try {
    const db = openLlmRuntimeDatabase()
    const rows = db
      .select()
      .from(llmConsumerDialogRefsTable)
      .where(and(
        eq(llmConsumerDialogRefsTable.agentId, input.agentId),
        eq(llmConsumerDialogRefsTable.consumer, input.consumer),
        eq(llmConsumerDialogRefsTable.provider, input.provider),
      ))
      .orderBy(desc(llmConsumerDialogRefsTable.updatedAt))
      .all()

    return ok(rows.map((row) => ({
      agentId: row.agentId,
      consumer: row.consumer,
      provider: toProvider(row.provider, input.provider),
      providerSessionRef: toText(row.providerSessionRef),
      dialogTitle: toText(row.dialogTitle),
      createdAt: toText(row.createdAt),
      updatedAt: toText(row.updatedAt),
      lastStatus: toText(row.lastStatus) || 'done',
    })))
  } catch (error) {
    return err({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to read llm runtime dialog refs.',
    })
  }
}

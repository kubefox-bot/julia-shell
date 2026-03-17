import { and, eq } from 'drizzle-orm'
import type { Result } from '@shared/lib/result'
import { nowIso } from '@shared/lib/time'
import { runDb } from '@core/db/result'
import { openLlmRuntimeDatabase } from './runtime-drizzle'
import { llmConsumerDialogStateTable } from './runtime-schema'
import { toText, type LlmRuntimeDialogState, type LlmRuntimeError, type LlmRuntimeProvider } from './runtime-repository.shared'

export function getLlmRuntimeDialogState(input: {
  agentId: string
  consumer: string
  provider: LlmRuntimeProvider
}): Result<LlmRuntimeDialogState, LlmRuntimeError> {
  return runDb(
    () => {
      const db = openLlmRuntimeDatabase()
      const row = db
        .select()
        .from(llmConsumerDialogStateTable)
        .where(and(
          eq(llmConsumerDialogStateTable.agentId, input.agentId),
          eq(llmConsumerDialogStateTable.consumer, input.consumer),
          eq(llmConsumerDialogStateTable.provider, input.provider)
        ))
        .get()

      return {
        agentId: input.agentId,
        consumer: input.consumer,
        provider: input.provider,
        providerSessionRef: toText(row?.providerSessionRef),
        dialogTitle: toText(row?.dialogTitle),
        status: toText(row?.status) || 'idle',
        lastError: row?.lastError ?? null,
        updatedAt: row?.updatedAt ?? null
      }
    },
    (error) => ({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to read llm runtime dialog state.'
    })
  )
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
  return runDb(
    () => {
      const db = openLlmRuntimeDatabase()
      const existing = db
        .select()
        .from(llmConsumerDialogStateTable)
        .where(and(
          eq(llmConsumerDialogStateTable.agentId, input.agentId),
          eq(llmConsumerDialogStateTable.consumer, input.consumer),
          eq(llmConsumerDialogStateTable.provider, input.provider)
        ))
        .get()
      const dialogTitle = typeof input.dialogTitle === 'string' ? toText(input.dialogTitle) : toText(existing?.dialogTitle)

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
          updatedAt: nowIso()
        })
        .onConflictDoUpdate({
          target: [
            llmConsumerDialogStateTable.agentId,
            llmConsumerDialogStateTable.consumer,
            llmConsumerDialogStateTable.provider
          ],
          set: {
            providerSessionRef: toText(input.providerSessionRef),
            dialogTitle,
            status: toText(input.status) || 'idle',
            lastError: input.lastError,
            updatedAt: nowIso()
          }
        })
        .run()

      return undefined
    },
    (error) => ({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to write llm runtime dialog state.'
    })
  )
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
    lastError: null
  })
}

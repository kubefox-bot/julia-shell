import { and, desc, eq } from 'drizzle-orm'
import { err, ok, type Result } from 'neverthrow'
import { nowIso } from '@shared/lib/time'
import { openLlmRuntimeDatabase } from './runtime-drizzle'
import { llmConsumerDialogRefsTable } from './runtime-schema'
import {
  toProvider,
  toText,
  type LlmRuntimeDialogRef,
  type LlmRuntimeError,
  type LlmRuntimeProvider
} from './runtime-repository.shared'

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
        eq(llmConsumerDialogRefsTable.providerSessionRef, providerSessionRef)
      ))
      .get()
    const dialogTitle = typeof input.dialogTitle === 'string' ? toText(input.dialogTitle) : toText(existing?.dialogTitle)
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
        lastStatus: toText(input.lastStatus) || 'done'
      })
      .onConflictDoUpdate({
        target: [
          llmConsumerDialogRefsTable.agentId,
          llmConsumerDialogRefsTable.consumer,
          llmConsumerDialogRefsTable.provider,
          llmConsumerDialogRefsTable.providerSessionRef
        ],
        set: {
          dialogTitle,
          updatedAt: now,
          lastStatus: toText(input.lastStatus) || 'done'
        }
      })
      .run()

    return ok(undefined)
  } catch (error) {
    return err({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to write llm runtime dialog refs.'
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
        eq(llmConsumerDialogRefsTable.provider, input.provider)
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
      lastStatus: toText(row.lastStatus) || 'done'
    })))
  } catch (error) {
    return err({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to read llm runtime dialog refs.'
    })
  }
}

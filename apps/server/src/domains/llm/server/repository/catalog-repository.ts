import { nowIso } from '@shared/lib/time'
import { and, eq } from 'drizzle-orm'
import { err, ok, type Result } from 'neverthrow'
import { openLlmCatalogDatabase } from './catalog-drizzle'
import { llmModelCatalogTable } from './catalog-schema'

export type LlmProvider = 'codex' | 'gemini'

export type LlmModelRow = {
  consumer: string
  provider: LlmProvider
  modelId: string
  updatedAt: string
}

export type LlmCatalogDbError = {
  code: 'db_error'
  message: string
}

export function listLlmModels(
  consumer: string,
  provider: LlmProvider
): Result<LlmModelRow[], LlmCatalogDbError> {
  try {
    const db = openLlmCatalogDatabase()
    const rows = db
      .select({
        consumer: llmModelCatalogTable.consumer,
        provider: llmModelCatalogTable.provider,
        modelId: llmModelCatalogTable.modelId,
        updatedAt: llmModelCatalogTable.updatedAt,
      })
      .from(llmModelCatalogTable)
      .where(and(
        eq(llmModelCatalogTable.consumer, consumer),
        eq(llmModelCatalogTable.provider, provider),
      ))
      .orderBy(llmModelCatalogTable.modelId)
      .all()

    return ok(rows.map((row) => ({
      consumer: row.consumer,
      provider,
      modelId: row.modelId,
      updatedAt: row.updatedAt,
    })))
  } catch (error) {
    return err({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to read llm catalog.',
    })
  }
}

export function replaceLlmModels(input: {
  consumer: string
  provider: LlmProvider
  modelIds: string[]
}): Result<{ updatedAt: string; count: number }, LlmCatalogDbError> {
  try {
    const db = openLlmCatalogDatabase()
    const now = nowIso()
    const modelIds = Array.from(new Set(input.modelIds.map((item) => item.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))

    db.transaction((tx) => {
      tx
        .delete(llmModelCatalogTable)
        .where(and(
          eq(llmModelCatalogTable.consumer, input.consumer),
          eq(llmModelCatalogTable.provider, input.provider),
        ))
        .run()

      for (const modelId of modelIds) {
        tx
          .insert(llmModelCatalogTable)
          .values({
            consumer: input.consumer,
            provider: input.provider,
            modelId,
            updatedAt: now,
          })
          .run()
      }
    })

    return ok({
      updatedAt: now,
      count: modelIds.length,
    })
  } catch (error) {
    return err({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to write llm catalog.',
    })
  }
}

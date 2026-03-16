import { and, eq } from 'drizzle-orm'
import type { Result } from '@shared/lib/result'
import { nowIso } from '@shared/lib/time'
import { runDb } from '@core/db/result'
import { openLlmRuntimeDatabase } from './runtime-drizzle'
import { llmConsumerSettingsTable } from './runtime-schema'
import {
  parseArgs,
  toArgs,
  toProvider,
  toText,
  type LlmRuntimeError,
  type LlmRuntimeSettings,
} from './runtime-repository.shared'

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
  return runDb(
    () => {
      const db = openLlmRuntimeDatabase()
      const row = db
        .select()
        .from(llmConsumerSettingsTable)
        .where(and(
          eq(llmConsumerSettingsTable.agentId, input.agentId),
          eq(llmConsumerSettingsTable.consumer, input.consumer)
        ))
        .get()

      return {
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
        updatedAt: row?.updatedAt ?? null
      }
    },
    (error) => ({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to read llm runtime settings.'
    })
  )
}

export function upsertLlmRuntimeSettings(input: {
  agentId: string
  consumer: string
  value: Omit<LlmRuntimeSettings, 'updatedAt' | 'agentId' | 'consumer'>
}): Result<void, LlmRuntimeError> {
  return runDb(
    () => {
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
          updatedAt: nowIso()
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
            updatedAt: nowIso()
          }
        })
        .run()

      return undefined
    },
    (error) => ({
      code: 'db_error',
      message: error instanceof Error ? error.message : 'Failed to write llm runtime settings.'
    })
  )
}

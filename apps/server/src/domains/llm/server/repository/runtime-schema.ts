import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const llmConsumerSettingsTable = sqliteTable('llm_consumer_settings', {
  agentId: text('agent_id').notNull(),
  consumer: text('consumer').notNull(),
  activeProvider: text('active_provider').notNull().default('codex'),
  codexApiKey: text('codex_api_key'),
  geminiApiKey: text('gemini_api_key'),
  codexCommand: text('codex_command').notNull().default('codex'),
  codexArgsJson: text('codex_args_json').notNull().default('[]'),
  codexModel: text('codex_model').notNull().default('gpt-5-codex'),
  geminiCommand: text('gemini_command').notNull().default('gemini'),
  geminiArgsJson: text('gemini_args_json').notNull().default('["--output-format","stream-json"]'),
  geminiModel: text('gemini_model').notNull().default('gemini-2.5-flash'),
  useShellFallback: integer('use_shell_fallback', { mode: 'boolean' }).notNull().default(false),
  shellOverride: text('shell_override'),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.agentId, table.consumer] }),
])

export const llmConsumerDialogStateTable = sqliteTable('llm_consumer_dialog_state', {
  agentId: text('agent_id').notNull(),
  consumer: text('consumer').notNull(),
  provider: text('provider').notNull(),
  providerSessionRef: text('provider_session_ref').notNull().default(''),
  dialogTitle: text('dialog_title').notNull().default(''),
  status: text('status').notNull().default('idle'),
  lastError: text('last_error'),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.agentId, table.consumer, table.provider] }),
])

export const llmConsumerDialogRefsTable = sqliteTable('llm_consumer_dialog_refs', {
  agentId: text('agent_id').notNull(),
  consumer: text('consumer').notNull(),
  provider: text('provider').notNull(),
  providerSessionRef: text('provider_session_ref').notNull(),
  dialogTitle: text('dialog_title').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  lastStatus: text('last_status').notNull().default('done'),
}, (table) => [
  primaryKey({ columns: [table.agentId, table.consumer, table.provider, table.providerSessionRef] }),
])

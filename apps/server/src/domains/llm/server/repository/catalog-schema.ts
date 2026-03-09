import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const llmModelCatalogTable = sqliteTable('llm_model_catalog', {
  consumer: text('consumer').notNull(),
  provider: text('provider').notNull(),
  modelId: text('model_id').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.consumer, table.provider, table.modelId] }),
])

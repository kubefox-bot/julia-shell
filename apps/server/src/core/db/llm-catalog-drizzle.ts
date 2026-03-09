import { drizzle } from 'drizzle-orm/better-sqlite3'
import { openDb } from './shared'
import * as schema from './llm-catalog-schema'

function ensureSchema() {
  const sqlite = openDb('llm-catalog.db')
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS llm_model_catalog (
      consumer TEXT NOT NULL,
      provider TEXT NOT NULL,
      model_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (consumer, provider, model_id)
    );

    CREATE INDEX IF NOT EXISTS idx_llm_model_catalog_updated
      ON llm_model_catalog(consumer, provider, updated_at DESC);
  `)
}

export function openLlmCatalogSqlite() {
  ensureSchema()
  return openDb('llm-catalog.db')
}

export function openLlmCatalogDatabase() {
  return drizzle(openLlmCatalogSqlite(), { schema })
}

import { drizzle } from 'drizzle-orm/better-sqlite3'
import { openDb } from '../../../../core/db/shared'
import * as schema from './runtime-schema'

function ensureSchema() {
  const sqlite = openDb('llm-runtime.db')
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS llm_consumer_settings (
      agent_id TEXT NOT NULL,
      consumer TEXT NOT NULL,
      active_provider TEXT NOT NULL DEFAULT 'codex',
      codex_api_key TEXT,
      gemini_api_key TEXT,
      codex_command TEXT NOT NULL DEFAULT 'codex',
      codex_args_json TEXT NOT NULL DEFAULT '[]',
      codex_model TEXT NOT NULL DEFAULT 'gpt-5-codex',
      gemini_command TEXT NOT NULL DEFAULT 'gemini',
      gemini_args_json TEXT NOT NULL DEFAULT '["--output-format","stream-json"]',
      gemini_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
      use_shell_fallback INTEGER NOT NULL DEFAULT 0,
      shell_override TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, consumer)
    );

    CREATE TABLE IF NOT EXISTS llm_consumer_dialog_state (
      agent_id TEXT NOT NULL,
      consumer TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_session_ref TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'idle',
      last_error TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, consumer, provider)
    );

    CREATE TABLE IF NOT EXISTS llm_consumer_dialog_refs (
      agent_id TEXT NOT NULL,
      consumer TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_session_ref TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_status TEXT NOT NULL DEFAULT 'done',
      PRIMARY KEY (agent_id, consumer, provider, provider_session_ref)
    );
  `)
}

export function openLlmRuntimeDatabase() {
  ensureSchema()
  return drizzle(openDb('llm-runtime.db'), { schema })
}

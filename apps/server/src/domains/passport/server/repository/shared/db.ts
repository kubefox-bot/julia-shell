import { openPassportDatabase, openPassportSqlite } from '@passport/server/repository/shared/passport-drizzle';

function bootstrapPassportSchema() {
  const sqlite = openPassportSqlite();

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agent_registry (
      agent_id TEXT PRIMARY KEY,
      display_name TEXT,
      status TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_sessions (
      session_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL,
      connected_at TEXT NOT NULL,
      last_heartbeat_at TEXT NOT NULL,
      disconnected_at TEXT,
      disconnect_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_tokens (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      token_type TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_events (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      session_id TEXT,
      job_id TEXT,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      received_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_enrollment_tokens (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      label TEXT,
      uses_total INTEGER NOT NULL,
      uses_left INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      revoked_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent ON agent_sessions(agent_id, status);
    CREATE INDEX IF NOT EXISTS idx_agent_tokens_agent ON agent_tokens(agent_id, revoked_at);
    CREATE INDEX IF NOT EXISTS idx_agent_events_agent ON agent_events(agent_id, received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_enrollment_agent ON agent_enrollment_tokens(agent_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_enrollment_expires ON agent_enrollment_tokens(expires_at);
  `);
}

export function getPassportDb() {
  bootstrapPassportSchema();
  return openPassportDatabase();
}

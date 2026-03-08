import { randomUUID } from 'node:crypto';
import { openDb } from '../db/shared';
import { nowIso } from '../../shared/lib/time';
import { createOpaqueToken, sha256 } from './crypto';

type EnrollmentTokenRow = {
  id: string;
  token_hash: string;
  label: string | null;
  uses_total: number;
  uses_left: number;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
};

type AgentTokenRow = {
  id: string;
  agent_id: string;
  token_hash: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
};

function getDb() {
  const db = openDb('agent.db');
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_agent_enrollment_expires ON agent_enrollment_tokens(expires_at);
  `);

  return db;
}

function parseIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function createEnrollmentToken(input: {
  ttlMinutes?: number;
  uses?: number;
  label?: string;
}) {
  const db = getDb();
  const now = nowIso();
  const ttlMinutes = Math.max(1, Math.min(60 * 24 * 7, Math.round(input.ttlMinutes ?? 60)));
  const uses = Math.max(1, Math.min(10, Math.round(input.uses ?? 1)));

  const enrollmentToken = createOpaqueToken(32);
  const tokenHash = sha256(enrollmentToken);
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();

  db.prepare(`
    INSERT INTO agent_enrollment_tokens (
      id,
      token_hash,
      label,
      uses_total,
      uses_left,
      created_at,
      expires_at,
      used_at,
      revoked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
  `).run(id, tokenHash, input.label?.trim() || null, uses, uses, now, expiresAt);

  return {
    tokenId: id,
    enrollmentToken,
    expiresAt,
    uses
  };
}

export function listEnrollmentTokens() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, label, uses_total, uses_left, created_at, expires_at, used_at, revoked_at
    FROM agent_enrollment_tokens
    ORDER BY created_at DESC
  `).all() as Array<{
    id: string;
    label: string | null;
    uses_total: number;
    uses_left: number;
    created_at: string;
    expires_at: string;
    used_at: string | null;
    revoked_at: string | null;
  }>;

  return rows.map((row) => ({
    tokenId: row.id,
    label: row.label,
    usesTotal: row.uses_total,
    usesLeft: row.uses_left,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    revokedAt: row.revoked_at
  }));
}

export function revokeEnrollmentToken(tokenId: string) {
  const db = getDb();
  const result = db.prepare(`
    UPDATE agent_enrollment_tokens
    SET revoked_at = ?
    WHERE id = ?
      AND revoked_at IS NULL
  `).run(nowIso(), tokenId);

  return result.changes > 0;
}

export function consumeEnrollmentToken(rawToken: string) {
  const db = getDb();
  const tokenHash = sha256(rawToken);
  const row = db.prepare(`
    SELECT id, token_hash, label, uses_total, uses_left, created_at, expires_at, used_at, revoked_at
    FROM agent_enrollment_tokens
    WHERE token_hash = ?
    LIMIT 1
  `).get(tokenHash) as EnrollmentTokenRow | undefined;

  if (!row) {
    return null;
  }

  if (row.revoked_at) {
    return null;
  }

  const expiresAt = parseIso(row.expires_at);
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (row.uses_left <= 0) {
    return null;
  }

  const nextUsesLeft = row.uses_left - 1;
  const usedAt = nextUsesLeft === 0 ? nowIso() : row.used_at;

  db.prepare(`
    UPDATE agent_enrollment_tokens
    SET uses_left = ?, used_at = ?
    WHERE id = ? AND uses_left = ?
  `).run(nextUsesLeft, usedAt, row.id, row.uses_left);

  return {
    tokenId: row.id,
    usesLeft: nextUsesLeft
  };
}

export function registerAgent(input: {
  displayName: string;
  capabilities: unknown;
  version: string;
}) {
  const db = getDb();
  const now = nowIso();
  const agentId = randomUUID();

  db.prepare(`
    INSERT INTO agent_registry (
      agent_id,
      display_name,
      status,
      capabilities_json,
      version,
      created_at,
      updated_at
    ) VALUES (?, ?, 'online', ?, ?, ?, ?)
  `).run(
    agentId,
    input.displayName,
    JSON.stringify(input.capabilities ?? []),
    input.version,
    now,
    now
  );

  return agentId;
}

export function issueRefreshToken(agentId: string) {
  const db = getDb();
  const token = createOpaqueToken(48);
  const tokenHash = sha256(token);
  const now = nowIso();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  db.prepare(`
    INSERT INTO agent_tokens (
      id,
      agent_id,
      token_type,
      token_hash,
      issued_at,
      expires_at,
      revoked_at
    ) VALUES (?, ?, 'refresh', ?, ?, ?, NULL)
  `).run(randomUUID(), agentId, tokenHash, now, expiresAt);

  return {
    refreshToken: token,
    expiresAt
  };
}

export function rotateRefreshToken(agentId: string, refreshToken: string) {
  const db = getDb();
  const tokenHash = sha256(refreshToken);
  const row = db.prepare(`
    SELECT id, agent_id, token_hash, issued_at, expires_at, revoked_at
    FROM agent_tokens
    WHERE agent_id = ? AND token_hash = ? AND token_type = 'refresh'
    LIMIT 1
  `).get(agentId, tokenHash) as AgentTokenRow | undefined;

  if (!row) {
    return null;
  }

  if (row.revoked_at) {
    return null;
  }

  const expiresAt = parseIso(row.expires_at);
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    return null;
  }

  db.prepare(`
    UPDATE agent_tokens
    SET revoked_at = ?
    WHERE id = ?
  `).run(nowIso(), row.id);

  return issueRefreshToken(agentId);
}

export function revokeRefreshToken(agentId: string, refreshToken: string) {
  const db = getDb();
  const tokenHash = sha256(refreshToken);

  const result = db.prepare(`
    UPDATE agent_tokens
    SET revoked_at = ?
    WHERE agent_id = ?
      AND token_hash = ?
      AND token_type = 'refresh'
      AND revoked_at IS NULL
  `).run(nowIso(), agentId, tokenHash);

  return result.changes > 0;
}

export function upsertAgentSession(input: {
  sessionId: string;
  agentId: string;
  status: string;
  disconnectReason?: string | null;
}) {
  const db = getDb();
  const now = nowIso();

  db.prepare(`
    INSERT INTO agent_sessions (
      session_id,
      agent_id,
      status,
      connected_at,
      last_heartbeat_at,
      disconnected_at,
      disconnect_reason
    ) VALUES (?, ?, ?, ?, ?, NULL, NULL)
    ON CONFLICT(session_id) DO UPDATE SET
      status = excluded.status,
      last_heartbeat_at = excluded.last_heartbeat_at,
      disconnected_at = CASE WHEN excluded.status = 'disconnected' THEN excluded.last_heartbeat_at ELSE agent_sessions.disconnected_at END,
      disconnect_reason = CASE WHEN excluded.status = 'disconnected' THEN ? ELSE agent_sessions.disconnect_reason END
  `).run(input.sessionId, input.agentId, input.status, now, now, input.disconnectReason ?? null);
}

export function getAnyOnlineAgentSession(input?: { minHeartbeatAt?: string }) {
  const db = getDb();
  const baseSql = `
    SELECT session_id, agent_id, status, connected_at, last_heartbeat_at
    FROM agent_sessions
    WHERE status = 'online'
  `;
  const withHeartbeatFilter = `${baseSql} AND last_heartbeat_at >= ? ORDER BY last_heartbeat_at DESC LIMIT 1`;
  const withoutHeartbeatFilter = `${baseSql} ORDER BY last_heartbeat_at DESC LIMIT 1`;

  const row = (input?.minHeartbeatAt
    ? db.prepare(withHeartbeatFilter).get(input.minHeartbeatAt)
    : db.prepare(withoutHeartbeatFilter).get()) as {
    session_id: string;
    agent_id: string;
    status: string;
    connected_at: string;
    last_heartbeat_at: string;
  } | undefined;

  if (!row) {
    return null;
  }

  return {
    sessionId: row.session_id,
    agentId: row.agent_id,
    status: row.status,
    connectedAt: row.connected_at,
    lastHeartbeatAt: row.last_heartbeat_at
  };
}

export function disconnectStaleOnlineSessions(input: {
  cutoffIso: string;
  reason?: string;
}) {
  const db = getDb();
  const now = nowIso();
  const reason = input.reason ?? 'heartbeat_timeout';
  const result = db.prepare(`
    UPDATE agent_sessions
    SET
      status = 'disconnected',
      disconnected_at = ?,
      disconnect_reason = ?
    WHERE status = 'online'
      AND last_heartbeat_at < ?
  `).run(now, reason, input.cutoffIso);

  return result.changes;
}

export function appendAgentEvent(input: {
  agentId: string;
  sessionId?: string | null;
  jobId?: string | null;
  eventType: string;
  payload: unknown;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO agent_events (
      id,
      agent_id,
      session_id,
      job_id,
      event_type,
      payload_json,
      received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    input.agentId,
    input.sessionId ?? null,
    input.jobId ?? null,
    input.eventType,
    JSON.stringify(input.payload ?? null),
    nowIso()
  );
}

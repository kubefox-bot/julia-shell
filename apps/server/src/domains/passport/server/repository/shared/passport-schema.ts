import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const agentRegistryTable = sqliteTable('agent_registry', {
  agentId: text('agent_id').primaryKey(),
  displayName: text('display_name'),
  status: text('status').notNull(),
  capabilitiesJson: text('capabilities_json').notNull(),
  version: text('version').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const agentSessionsTable = sqliteTable('agent_sessions', {
  sessionId: text('session_id').primaryKey(),
  agentId: text('agent_id').notNull(),
  status: text('status').notNull(),
  connectedAt: text('connected_at').notNull(),
  lastHeartbeatAt: text('last_heartbeat_at').notNull(),
  disconnectedAt: text('disconnected_at'),
  disconnectReason: text('disconnect_reason')
}, (table) => [
  index('idx_agent_sessions_agent').on(table.agentId, table.status)
]);

export const agentTokensTable = sqliteTable('agent_tokens', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  tokenType: text('token_type').notNull(),
  tokenHash: text('token_hash').notNull(),
  issuedAt: text('issued_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  revokedAt: text('revoked_at')
}, (table) => [
  index('idx_agent_tokens_agent').on(table.agentId, table.revokedAt)
]);

export const agentEventsTable = sqliteTable('agent_events', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  sessionId: text('session_id'),
  jobId: text('job_id'),
  eventType: text('event_type').notNull(),
  payloadJson: text('payload_json').notNull(),
  receivedAt: text('received_at').notNull()
}, (table) => [
  index('idx_agent_events_agent').on(table.agentId, table.receivedAt)
]);

export const agentEnrollmentTokensTable = sqliteTable('agent_enrollment_tokens', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  label: text('label'),
  usesTotal: integer('uses_total').notNull(),
  usesLeft: integer('uses_left').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  revokedAt: text('revoked_at')
}, (table) => [
  uniqueIndex('ux_agent_enrollment_tokens_token_hash').on(table.tokenHash),
  index('idx_agent_enrollment_agent').on(table.agentId, table.createdAt),
  index('idx_agent_enrollment_expires').on(table.expiresAt)
]);

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, resetDbCache } from '@/core/db/shared';
import {
  createEnrollmentToken,
  issueRefreshToken,
  rotateRefreshToken,
  upsertAgentSession
} from '../server/repository';
import { isExpiredIso, resolveEnrollmentTtlMinutes, resolveEnrollmentUses } from '@passport/server/repository/shared';

const DEFAULT_TTL_MINUTES = 60;
const MIN_TTL_MINUTES = 1;
const MAX_TTL_MINUTES = 10080;
const OUT_OF_RANGE_TTL_MINUTES = 999999;
const OUT_OF_RANGE_USES = 999;
const DEFAULT_USES = 1;
const MAX_USES = 10;

let tempDir = '';

describe('passport repository branch coverage helpers', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'passport-repository-branches-'));
    process.env.JULIAAPP_DATA_DIR = tempDir;
  });

  afterEach(() => {
    resetDbCache();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.JULIAAPP_DATA_DIR;
  });

  it('clamps enrollment TTL/uses and resolves defaults', () => {
    expect(resolveEnrollmentTtlMinutes(undefined)).toBe(DEFAULT_TTL_MINUTES);
    expect(resolveEnrollmentTtlMinutes(0)).toBe(MIN_TTL_MINUTES);
    expect(resolveEnrollmentTtlMinutes(OUT_OF_RANGE_TTL_MINUTES)).toBe(MAX_TTL_MINUTES);

    expect(resolveEnrollmentUses(undefined)).toBe(DEFAULT_USES);
    expect(resolveEnrollmentUses(0)).toBe(DEFAULT_USES);
    expect(resolveEnrollmentUses(OUT_OF_RANGE_USES)).toBe(MAX_USES);
  });

  it('evaluates expiry for invalid/past/future ISO timestamps', () => {
    expect(isExpiredIso('not-iso')).toBe(true);
    expect(isExpiredIso(DateTime.utc().minus({ minutes: 1 }).toISO() ?? '')).toBe(true);
    expect(isExpiredIso(DateTime.utc().plus({ minutes: 1 }).toISO() ?? '')).toBe(false);
  });

  it('updates session with disconnected branch fields', () => {
    const created = createEnrollmentToken({ label: 'pc', uses: 1, ttlMinutes: 5 });

    upsertAgentSession({
      sessionId: 'session-1',
      agentId: created.agentId,
      status: 'online'
    });

    upsertAgentSession({
      sessionId: 'session-1',
      agentId: created.agentId,
      status: 'disconnected',
      disconnectReason: 'manual_shutdown'
    });

    const db = openDb('passport.db');
    const row = db.prepare(`
      SELECT status, disconnected_at as disconnectedAt, disconnect_reason as disconnectReason
      FROM agent_sessions
      WHERE session_id = ?
      LIMIT 1
    `).get('session-1') as {
      status: string;
      disconnectedAt: string | null;
      disconnectReason: string | null;
    };

    expect(row.status).toBe('disconnected');
    expect(row.disconnectedAt).not.toBeNull();
    expect(row.disconnectReason).toBe('manual_shutdown');
  });

  it('rejects refresh rotation when refresh token is expired', () => {
    const created = createEnrollmentToken({ label: 'pc', uses: 1, ttlMinutes: 5 });
    const refresh = issueRefreshToken(created.agentId);

    const db = openDb('passport.db');
    db.prepare(`
      UPDATE agent_tokens
      SET expires_at = ?
      WHERE agent_id = ?
    `).run(DateTime.utc().minus({ minutes: 1 }).toISO() ?? '1970-01-01T00:00:00.000Z', created.agentId);

    const rotated = rotateRefreshToken(created.agentId, refresh.refreshToken);
    expect(rotated).toBeNull();
  });
});

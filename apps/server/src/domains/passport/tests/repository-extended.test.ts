import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, resetDbCache } from '@/core/db/shared';
import { nowIso } from '@/shared/lib/time';
import {
  appendAgentEvent,
  consumeEnrollmentToken,
  createEnrollmentToken,
  disconnectStaleOnlineSessions,
  getAgentDisplayName,
  getAnyOnlineAgentSession,
  listEnrollmentTokens,
  registerAgent,
  revokeEnrollmentToken,
  upsertAgentSession
} from '../server/repository';

let tempDir = '';

describe('passport repository extended coverage', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'passport-repository-'));
    process.env.JULIAAPP_DATA_DIR = tempDir;
  });

  afterEach(() => {
    resetDbCache();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.JULIAAPP_DATA_DIR;
  });

  it('lists and revokes enrollment tokens with agent_id', () => {
    const created = createEnrollmentToken({ ttlMinutes: 5, uses: 2, label: 'mac' });
    const list = listEnrollmentTokens();

    expect(list[0]?.agentId).toBe(created.agentId);
    expect(list[0]?.usesLeft).toBe(2);

    expect(revokeEnrollmentToken(created.tokenId)).toBe(true);
    expect(revokeEnrollmentToken(created.tokenId)).toBe(false);
    expect(consumeEnrollmentToken(created.enrollmentToken, created.agentId)).toBeNull();
  });

  it('tracks online sessions and disconnection state', () => {
    const created = createEnrollmentToken({ ttlMinutes: 5, uses: 1, label: 'windows' });
    registerAgent({
      agentId: created.agentId,
      displayName: 'win-host',
      capabilities: ['health'],
      version: '0.1.0'
    });

    upsertAgentSession({
      sessionId: 'session-1',
      agentId: created.agentId,
      status: 'online'
    });

    expect(getAgentDisplayName(created.agentId)).toBe('win-host');
    expect(getAnyOnlineAgentSession()).toMatchObject({
      sessionId: 'session-1',
      agentId: created.agentId
    });

    const changes = disconnectStaleOnlineSessions({
      cutoffIso: DateTime.utc().plus({ minutes: 1 }).toISO() ?? nowIso()
    });
    expect(changes).toBe(1);
    expect(getAnyOnlineAgentSession()).toBeNull();
  });

  it('appends events to passport event log', () => {
    const created = createEnrollmentToken({ ttlMinutes: 5, uses: 1, label: 'linux' });
    appendAgentEvent({
      agentId: created.agentId,
      sessionId: 'session-1',
      jobId: 'job-1',
      eventType: 'progress',
      payload: { percent: 10 }
    });

    const db = openDb('passport.db');
    const row = db.prepare('SELECT COUNT(*) as count FROM agent_events').get() as { count: number };
    expect(row.count).toBe(1);
  });
});

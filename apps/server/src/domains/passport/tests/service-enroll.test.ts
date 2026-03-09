import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/config', () => ({
  resolvePassportJwtSecret: vi.fn(async () => 'secret')
}));

import { resetDbCache } from '../../../core/db/shared';
import { createEnrollmentToken } from '../server/repository';
import { enrollPassportAgent, refreshPassportSession } from '../server/service';

const MIN_TOKEN_LENGTH = 20;

let tempDir = '';

describe('passport enroll/refresh service', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'passport-service-'));
    process.env.JULIAAPP_DATA_DIR = tempDir;
  });

  afterEach(() => {
    resetDbCache();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.JULIAAPP_DATA_DIR;
  });

  it('enrolls with matching agent_id + enrollment_token pair', async () => {
    const created = createEnrollmentToken({ ttlMinutes: 5, uses: 1, label: 'pc-1' });

    const enrolled = await enrollPassportAgent({
      agentId: created.agentId,
      enrollmentToken: created.enrollmentToken,
      deviceInfo: 'pc-1',
      agentVersion: '0.1.0',
      capabilities: ['health']
    });

    expect(enrolled).not.toBeNull();
    expect(enrolled?.agentId).toBe(created.agentId);
    expect(enrolled?.accessJwt.length).toBeGreaterThan(MIN_TOKEN_LENGTH);
    expect(enrolled?.refreshToken.length).toBeGreaterThan(MIN_TOKEN_LENGTH);
  });

  it('rejects enroll when agent_id mismatches token reservation', async () => {
    const created = createEnrollmentToken({ ttlMinutes: 5, uses: 1, label: 'pc-1' });

    const enrolled = await enrollPassportAgent({
      agentId: 'another-agent',
      enrollmentToken: created.enrollmentToken,
      deviceInfo: 'pc-1',
      agentVersion: '0.1.0',
      capabilities: ['health']
    });

    expect(enrolled).toBeNull();
  });

  it('rotates refresh token on valid refresh request', async () => {
    const created = createEnrollmentToken({ ttlMinutes: 5, uses: 1, label: 'pc-1' });
    const enrolled = await enrollPassportAgent({
      agentId: created.agentId,
      enrollmentToken: created.enrollmentToken,
      deviceInfo: 'pc-1',
      agentVersion: '0.1.0',
      capabilities: ['health']
    });

    if (!enrolled) {
      throw new Error('enroll expected');
    }

    const refreshed = await refreshPassportSession({
      agentId: enrolled.agentId,
      refreshToken: enrolled.refreshToken
    });

    expect(refreshed).not.toBeNull();
    expect(refreshed?.refreshToken).not.toBe(enrolled.refreshToken);
    expect(refreshed?.accessJwt).not.toBe(enrolled.accessJwt);
  });
});

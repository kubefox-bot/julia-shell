import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  consumeEnrollmentToken,
  createEnrollmentToken,
  issueRefreshToken,
  registerAgent,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../src/domains/passport/server/repository';
import { resetDbCache } from '../src/core/db/shared';

let tempDir = '';

describe('agent repository', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-repo-'));
    process.env.JULIAAPP_DATA_DIR = tempDir;
  });

  afterEach(() => {
    resetDbCache();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.JULIAAPP_DATA_DIR;
  });

  it('creates and consumes one-time enrollment tokens', () => {
    const created = createEnrollmentToken({ ttlMinutes: 5, uses: 1, label: 'pc-1' });
    expect(created.enrollmentToken.length).toBeGreaterThan(10);

    const firstConsume = consumeEnrollmentToken(created.enrollmentToken, created.agentId);
    expect(firstConsume).not.toBeNull();

    const secondConsume = consumeEnrollmentToken(created.enrollmentToken, created.agentId);
    expect(secondConsume).toBeNull();
  });

  it('rotates refresh tokens and rejects revoked ones', () => {
    const reservedAgentId = createEnrollmentToken({ ttlMinutes: 5, uses: 1, label: 'agent' }).agentId;
    const agentId = registerAgent({
      agentId: reservedAgentId,
      displayName: 'agent',
      capabilities: ['health'],
      version: '0.1.0',
    });

    const issued = issueRefreshToken(agentId);
    const rotated = rotateRefreshToken(agentId, issued.refreshToken);

    expect(rotated).not.toBeNull();
    if (!rotated) {
      return;
    }

    const revoked = revokeRefreshToken(agentId, issued.refreshToken);
    expect(revoked).toBe(false);

    const revokeRotated = revokeRefreshToken(agentId, rotated.refreshToken);
    expect(revokeRotated).toBe(true);
  });
});

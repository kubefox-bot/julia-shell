import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDbCache } from '../src/core/db/shared';
import { listShellModules } from '../src/core/services/shell-service';

const ANONYMOUS_AGENT_ID = 'public-anonymous';
const TRANSCRIBE_WIDGET_ID = 'com.yulia.transcribe';

let tempDir = '';

describe('shell service passport access policy', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-service-passport-'));
    process.env.JULIAAPP_DATA_DIR = tempDir;
  });

  afterEach(() => {
    resetDbCache();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.JULIAAPP_DATA_DIR;
  });

  it('marks transcribe as not ready when passport access is missing', async () => {
    const modules = await listShellModules(ANONYMOUS_AGENT_ID, {
      hasPassportAccess: false
    });
    const transcribe = modules.find((item) => item.id === TRANSCRIBE_WIDGET_ID);

    expect(transcribe).toBeDefined();
    expect(transcribe?.ready).toBe(false);
    expect(transcribe?.enabled).toBe(false);
    expect(transcribe?.notReadyReasons).toContain('Passport access token is required for this widget.');
  });
});

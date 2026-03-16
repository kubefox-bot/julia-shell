import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDbCache } from '../src/core/db/shared';
import { PASSPORT_ANONYMOUS_AGENT_ID } from '../src/domains/passport/server/config/consts';
import { listShellModules } from '../src/core/services/shell-service';
import { TERMINAL_AGENT_WIDGET_ID, TRANSCRIBE_WIDGET_ID } from '../src/widgets';

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
    const modules = await listShellModules(PASSPORT_ANONYMOUS_AGENT_ID, {
      hasPassportAccess: false
    });
    const transcribe = modules.find((item) => item.id === TRANSCRIBE_WIDGET_ID);
    const terminalAgent = modules.find((item) => item.id === TERMINAL_AGENT_WIDGET_ID);

    expect(transcribe).toBeDefined();
    expect(transcribe?.ready).toBe(false);
    expect(transcribe?.enabled).toBe(false);
    expect(transcribe?.notReadyReasons).toContain('com.yulia.transcribe widget requires agent.');

    expect(terminalAgent).toBeDefined();
    expect(terminalAgent?.ready).toBe(false);
    expect(terminalAgent?.enabled).toBe(false);
    expect(terminalAgent?.notReadyReasons).toContain('com.yulia.terminal-agent widget requires agent.');
  });
});

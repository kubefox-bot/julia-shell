import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureDefaultLayoutItem,
  ensureDefaultModuleState,
  getLayoutItems,
  getLayoutSettings,
  getModuleStates,
  saveLayoutSettings,
  setModuleEnabled,
  upsertLayoutItem
} from '../src/core/db/core-repository';
import { resetDbCache } from '../src/core/db/shared';

const DEFAULT_DESKTOP_COLUMNS = 12;

let tempDir = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-core-db-'));
  process.env.JULIAAPP_DATA_DIR = tempDir;
});

afterEach(() => {
  resetDbCache();
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.JULIAAPP_DATA_DIR;
});

describe('core repository', () => {
  it('persists layout settings and layout rows', () => {
    const agentId = 'agent-a';
    const initial = getLayoutSettings(agentId);
    expect(initial.desktopColumns).toBe(DEFAULT_DESKTOP_COLUMNS);
    expect(initial.locale).toBe('ru');
    expect(initial.theme).toBe('auto');

    saveLayoutSettings(agentId, { desktopColumns: 10, mobileColumns: 2, locale: 'en', theme: 'night' });

    ensureDefaultLayoutItem(agentId, { widgetId: 'com.test.one', order: 0, size: 'medium' });
    upsertLayoutItem(agentId, { widgetId: 'com.test.one', order: 2, size: 'large' });

    const saved = getLayoutSettings(agentId);
    const layout = getLayoutItems(agentId);

    expect(saved).toEqual({ desktopColumns: 10, mobileColumns: 2, locale: 'en', theme: 'night' });
    expect(layout).toEqual([{ widgetId: 'com.test.one', order: 2, size: 'large' }]);
  });

  it('persists module enabled state', () => {
    const agentId = 'agent-a';
    ensureDefaultModuleState(agentId, 'com.test.two', true);
    setModuleEnabled(agentId, 'com.test.two', false, 'Disabled by test');

    const states = getModuleStates(agentId);

    expect(states).toEqual([
      {
        widgetId: 'com.test.two',
        enabled: false,
        disabledReason: 'Disabled by test'
      }
    ]);
  });
});

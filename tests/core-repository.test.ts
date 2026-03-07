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
    const initial = getLayoutSettings();
    expect(initial.desktopColumns).toBe(12);

    saveLayoutSettings({ desktopColumns: 10, mobileColumns: 2 });

    ensureDefaultLayoutItem({ widgetId: 'com.test.one', order: 0, size: 'medium' });
    upsertLayoutItem({ widgetId: 'com.test.one', order: 2, size: 'large' });

    const saved = getLayoutSettings();
    const layout = getLayoutItems();

    expect(saved).toEqual({ desktopColumns: 10, mobileColumns: 2 });
    expect(layout).toEqual([{ widgetId: 'com.test.one', order: 2, size: 'large' }]);
  });

  it('persists module enabled state', () => {
    ensureDefaultModuleState('com.test.two', true);
    setModuleEnabled('com.test.two', false, 'Disabled by test');

    const states = getModuleStates();

    expect(states).toEqual([
      {
        widgetId: 'com.test.two',
        enabled: false,
        disabledReason: 'Disabled by test'
      }
    ]);
  });
});

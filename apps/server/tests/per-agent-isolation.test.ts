import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getLayoutSettings, saveLayoutSettings } from '../src/core/db/core-repository';
import {
  createTranscribeJob,
  listRecentTranscribeJobs,
  saveTranscribeWidgetSettings
} from '../src/widgets/transcribe/server/repository';
import { resetDbCache } from '../src/core/db/shared';

let tempDir = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-per-agent-'));
  process.env.JULIAAPP_DATA_DIR = tempDir;
});

afterEach(() => {
  resetDbCache();
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.JULIAAPP_DATA_DIR;
});

describe('per-agent data isolation', () => {
  it('keeps shell settings isolated between agents', () => {
    saveLayoutSettings('agent-a', {
      desktopColumns: 10,
      mobileColumns: 2,
      locale: 'en',
      theme: 'night'
    });
    saveLayoutSettings('agent-b', {
      desktopColumns: 12,
      mobileColumns: 1,
      locale: 'ru',
      theme: 'day'
    });

    expect(getLayoutSettings('agent-a')).toMatchObject({
      desktopColumns: 10,
      mobileColumns: 2,
      locale: 'en',
      theme: 'night'
    });
    expect(getLayoutSettings('agent-b')).toMatchObject({
      desktopColumns: 12,
      mobileColumns: 1,
      locale: 'ru',
      theme: 'day'
    });
  });

  it('keeps transcribe jobs/settings isolated between agents', () => {
    saveTranscribeWidgetSettings({
      agentId: 'agent-a',
      widgetId: 'com.yulia.transcribe',
      geminiModel: 'model-a',
      localApiKey: 'key-a'
    });
    saveTranscribeWidgetSettings({
      agentId: 'agent-b',
      widgetId: 'com.yulia.transcribe',
      geminiModel: 'model-b',
      localApiKey: 'key-b'
    });

    createTranscribeJob({
      agentId: 'agent-a',
      widgetId: 'com.yulia.transcribe',
      folderPath: 'C:\\A',
      filePaths: ['C:\\A\\a.opus'],
      primarySourceFile: 'C:\\A\\a.opus',
      platform: 'windows',
      model: 'model-a'
    });
    createTranscribeJob({
      agentId: 'agent-b',
      widgetId: 'com.yulia.transcribe',
      folderPath: 'C:\\B',
      filePaths: ['C:\\B\\b.opus'],
      primarySourceFile: 'C:\\B\\b.opus',
      platform: 'windows',
      model: 'model-b'
    });

    const jobsA = listRecentTranscribeJobs('agent-a', 10);
    const jobsB = listRecentTranscribeJobs('agent-b', 10);

    expect(jobsA).toHaveLength(1);
    expect(jobsB).toHaveLength(1);
    expect(jobsA[0]?.model).toBe('model-a');
    expect(jobsB[0]?.model).toBe('model-b');
    expect(jobsA[0]?.agentId).toBe('agent-a');
    expect(jobsB[0]?.agentId).toBe('agent-b');
  });
});

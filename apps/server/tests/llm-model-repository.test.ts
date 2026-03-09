import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listLlmModels, replaceLlmModels } from '../src/core/db/llm-model-repository';
import { resetDbCache } from '../src/core/db/shared';

let tempDir = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-llm-catalog-db-'));
  process.env.JULIAAPP_DATA_DIR = tempDir;
});

afterEach(() => {
  resetDbCache();
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.JULIAAPP_DATA_DIR;
});

describe('llm-model repository', () => {
  it('replaces and lists models via Result API', () => {
    const replaceResult = replaceLlmModels({
      consumer: 'terminal-agent',
      provider: 'codex',
      modelIds: ['gpt-5', 'gpt-5', 'gpt-4.1', ''],
    });
    expect(replaceResult.isOk()).toBe(true);
    if (replaceResult.isErr()) {
      return;
    }
    expect(replaceResult.value.count).toBe(2);

    const listResult = listLlmModels('terminal-agent', 'codex');
    expect(listResult.isOk()).toBe(true);
    if (listResult.isErr()) {
      return;
    }

    expect(listResult.value.map((row) => row.modelId)).toEqual(['gpt-4.1', 'gpt-5']);
    expect(listResult.value.every((row) => row.provider === 'codex')).toBe(true);
  });

  it('isolates rows by consumer and provider', () => {
    replaceLlmModels({
      consumer: 'terminal-agent',
      provider: 'codex',
      modelIds: ['gpt-5'],
    });
    replaceLlmModels({
      consumer: 'transcribe',
      provider: 'gemini',
      modelIds: ['gemini-2.5-flash'],
    });

    const codexRows = listLlmModels('terminal-agent', 'codex');
    const geminiRows = listLlmModels('transcribe', 'gemini');
    const emptyRows = listLlmModels('terminal-agent', 'gemini');

    expect(codexRows.isOk()).toBe(true);
    expect(geminiRows.isOk()).toBe(true);
    expect(emptyRows.isOk()).toBe(true);

    if (codexRows.isOk()) {
      expect(codexRows.value.map((row) => row.modelId)).toEqual(['gpt-5']);
    }
    if (geminiRows.isOk()) {
      expect(geminiRows.value.map((row) => row.modelId)).toEqual(['gemini-2.5-flash']);
    }
    if (emptyRows.isOk()) {
      expect(emptyRows.value).toEqual([]);
    }
  });
});

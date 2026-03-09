import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceLlmModels } from '../src/domains/llm/server/repository/catalog-repository';
import { resetDbCache } from '../src/core/db/shared';
import { getLlmModelCatalog } from '../src/domains/llm/server/service';

let tempDir = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-llm-catalog-service-'));
  process.env.JULIAAPP_DATA_DIR = tempDir;
});

afterEach(() => {
  vi.restoreAllMocks();
  resetDbCache();
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.JULIAAPP_DATA_DIR;
});

describe('llm-catalog service', () => {
  it('returns fresh DB cache without remote call', async () => {
    replaceLlmModels({
      consumer: 'terminal-agent',
      provider: 'codex',
      modelIds: ['gpt-5', 'gpt-4.1'],
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await getLlmModelCatalog({
      provider: 'codex',
      apiKey: '',
      forceRefresh: false,
    });

    expect(result.isOk()).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    if (result.isOk()) {
      expect(result.value.source).toBe('db');
      expect(result.value.stale).toBe(false);
      expect(result.value.models).toEqual(['gpt-4.1', 'gpt-5']);
    }
  });

  it('loads remote OpenAI models and persists filtered list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [
          { id: 'gpt-5' },
          { id: 'o3' },
          { id: 'text-embedding-3-small' },
        ],
      }), { status: 200 })
    );

    const result = await getLlmModelCatalog({
      provider: 'codex',
      apiKey: 'codex-key',
      forceRefresh: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.source).toBe('remote');
      expect(result.value.stale).toBe(false);
      expect(result.value.models).toEqual(['gpt-5', 'o3']);
    }

    const secondRead = await getLlmModelCatalog({
      provider: 'codex',
      apiKey: '',
      forceRefresh: false,
    });
    expect(secondRead.isOk()).toBe(true);
    if (secondRead.isOk()) {
      expect(secondRead.value.models).toEqual(['gpt-5', 'o3']);
    }
  });

  it('falls back to DB when remote fails', async () => {
    replaceLlmModels({
      consumer: 'terminal-agent',
      provider: 'gemini',
      modelIds: ['gemini-2.5-flash'],
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('upstream failed', { status: 503 })
    );

    const result = await getLlmModelCatalog({
      provider: 'gemini',
      apiKey: 'gemini-key',
      forceRefresh: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.source).toBe('db');
      expect(result.value.stale).toBe(true);
      expect(result.value.models).toEqual(['gemini-2.5-flash']);
    }
  });

  it('returns payload validation error without cache', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ nope: true }), { status: 200 })
    );

    const result = await getLlmModelCatalog({
      provider: 'gemini',
      apiKey: 'gemini-key',
      forceRefresh: true,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('provider_payload_invalid');
      expect(result.error.retryable).toBe(false);
    }
  });
});

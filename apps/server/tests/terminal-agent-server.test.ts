import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { err, ok } from 'neverthrow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getTerminalAgentDialogState,
  saveTerminalAgentSettings,
  upsertTerminalAgentDialogState
} from '../src/domains/llm/server/repository/terminal-agent-repository';
import { resetDbCache } from '../src/core/db/shared';
import * as llmCatalogService from '../src/domains/llm/server/service';
import { passportRuntime } from '../src/domains/passport/server/runtime/runtime';
import type { WidgetRouteContext } from '../src/entities/widget/model/types';
import { moduleBus } from '../src/shared/lib/module-bus';
import { terminalAgentHandlers } from '../src/widgets/terminal-agent/server/handlers';
import { WIDGET_ID } from '../src/widgets/terminal-agent/server/constants';
import { terminalAgentServerModule } from '../src/widgets/terminal-agent/server/module';

type SseEvent = {
  event: string;
  payload: Record<string, unknown>;
};

let tempDir = '';

function createContext(input: {
  url: string;
  action: string;
  actionSegments?: string[];
  method?: string;
  body?: Record<string, unknown>;
  agentId?: string;
}): WidgetRouteContext {
  const requestInit: RequestInit = {
    method: input.method ?? 'GET'
  };
  if (input.body) {
    requestInit.headers = { 'Content-Type': 'application/json' };
    requestInit.body = JSON.stringify(input.body);
  }

  return {
    request: new Request(input.url, requestInit),
    agentId: input.agentId ?? 'agent-a',
    action: input.action,
    actionSegments: input.actionSegments ?? [input.action],
    params: {
      id: WIDGET_ID
    }
  };
}

function parseSseChunk(rawChunk: string): SseEvent | null {
  const lines = rawChunk.split('\n');
  let eventName = 'message';
  const dataLines: string[] = [];

  for (const lineRaw of lines) {
    const line = lineRaw.trimEnd();
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return {
      event: eventName,
      payload: JSON.parse(dataLines.join('\n')) as Record<string, unknown>
    };
  } catch {
    return null;
  }
}

async function collectSseEvents(response: Response) {
  if (!response.body) {
    throw new Error('SSE response body is missing.');
  }

  const events: SseEvent[] = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');
    while (true) {
      const boundary = buffer.indexOf('\n\n');
      if (boundary === -1) {
        break;
      }

      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseSseChunk(chunk);
      if (parsed) {
        events.push(parsed);
      }
    }
  }

  return events;
}

async function collectSseEventsWithTimeout(response: Response, timeoutMs = 1500) {
  let timer: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      collectSseEvents(response),
      new Promise<SseEvent[]>((_, reject) => {
        timer = setTimeout(() => reject(new Error('SSE stream timeout in test.')), timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

describe('terminal-agent server handlers', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-terminal-agent-server-'));
    process.env.JULIAAPP_DATA_DIR = tempDir;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetDbCache();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.JULIAAPP_DATA_DIR;
  });

  it('handles settings endpoints and resets continuity on provider switch', async () => {
    upsertTerminalAgentDialogState({
      agentId: 'agent-a',
      widgetId: WIDGET_ID,
      provider: 'codex',
      providerSessionRef: 'codex-ref',
      status: 'done',
      lastError: null
    });
    upsertTerminalAgentDialogState({
      agentId: 'agent-a',
      widgetId: WIDGET_ID,
      provider: 'gemini',
      providerSessionRef: 'gemini-ref',
      status: 'done',
      lastError: null
    });

    const getResponse = await terminalAgentHandlers['GET settings'](
      createContext({
        url: 'http://localhost/api/widget/com.yulia.terminal-agent/settings',
        action: 'settings'
      })
    );
    expect(getResponse.status).toBe(200);
    const initialSettings = await getResponse.json() as Record<string, unknown>;
    expect(initialSettings.activeProvider).toBe('codex');

    const postResponse = await terminalAgentHandlers['POST settings'](
      createContext({
        url: 'http://localhost/api/widget/com.yulia.terminal-agent/settings',
        method: 'POST',
        action: 'settings',
        body: {
          activeProvider: 'gemini',
          codexCommand: 'codex',
          codexArgs: ['--json'],
          geminiCommand: 'gemini',
          geminiArgs: ['--output-format', 'stream-json'],
          useShellFallback: true,
          shellOverride: 'pwsh'
        }
      })
    );

    expect(postResponse.status).toBe(200);
    const savedSettings = await postResponse.json() as Record<string, unknown>;
    expect(savedSettings.activeProvider).toBe('gemini');
    expect(savedSettings.useShellFallback).toBe(true);

    expect(getTerminalAgentDialogState('agent-a', WIDGET_ID, 'codex').providerSessionRef).toBe('');
    expect(getTerminalAgentDialogState('agent-a', WIDGET_ID, 'gemini').providerSessionRef).toBe('');
  });

  it('reports module readiness based on runtime online session', async () => {
    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue(null);
    await expect(terminalAgentServerModule.init?.()).resolves.toEqual({
      ready: false,
      reason: `${WIDGET_ID} widget requires agent.`
    });

    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue({
      agentId: 'runtime-agent',
      sessionId: 'runtime-session',
      hostname: 'host',
      accessJwt: 'token'
    });
    await expect(terminalAgentServerModule.init?.()).resolves.toEqual({ ready: true });
  });

  it('handles dialog reset and dispatches reset command to runtime', async () => {
    upsertTerminalAgentDialogState({
      agentId: 'agent-a',
      widgetId: WIDGET_ID,
      provider: 'codex',
      providerSessionRef: 'resume-codex',
      status: 'done',
      lastError: null
    });

    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue({
      agentId: 'runtime-agent',
      sessionId: 'runtime-session',
      hostname: 'host',
      accessJwt: 'token'
    });
    const resetSpy = vi
      .spyOn(passportRuntime, 'dispatchTerminalAgentResetDialog')
      .mockReturnValue(true);

    const response = await terminalAgentHandlers['POST dialog/new'](
      createContext({
        url: 'http://localhost/api/widget/com.yulia.terminal-agent/dialog/new',
        method: 'POST',
        action: 'dialog/new',
        actionSegments: ['dialog', 'new'],
        body: { provider: 'codex' }
      })
    );

    expect(response.status).toBe(200);
    expect(resetSpy).toHaveBeenCalledWith({
      agentId: 'runtime-agent',
      sessionId: 'runtime-session',
      dialogId: `${WIDGET_ID}:codex`,
      reason: 'new_dialog'
    });
    expect(getTerminalAgentDialogState('agent-a', WIDGET_ID, 'codex').providerSessionRef).toBe('');
  });

  it('streams status/chunks/done and persists continuity ref', async () => {
    saveTerminalAgentSettings({
      agentId: 'agent-a',
      widgetId: WIDGET_ID,
      activeProvider: 'codex',
      codexApiKey: 'codex-key',
      geminiApiKey: '',
      codexCommand: '/usr/local/bin/codex',
      codexArgs: ['--flag'],
      codexModel: 'gpt-5-codex',
      geminiCommand: 'gemini',
      geminiArgs: ['--output-format', 'stream-json'],
      geminiModel: 'gemini-2.5-flash',
      useShellFallback: false,
      shellOverride: ''
    });
    upsertTerminalAgentDialogState({
      agentId: 'agent-a',
      widgetId: WIDGET_ID,
      provider: 'codex',
      providerSessionRef: 'resume-ref',
      status: 'done',
      lastError: null
    });

    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue({
      agentId: 'runtime-agent',
      sessionId: 'runtime-session',
      hostname: 'host',
      accessJwt: 'token'
    });

    const dispatchSpy = vi
      .spyOn(passportRuntime, 'dispatchTerminalAgentSendMessage')
      .mockReturnValue(true);

    const response = await terminalAgentHandlers['POST message-stream'](
      createContext({
        url: 'http://localhost/api/widget/com.yulia.terminal-agent/message-stream',
        method: 'POST',
        action: 'message-stream',
        body: { provider: 'codex', message: 'Hello' }
      })
    );

    expect(response.status).toBe(200);
    await vi.waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });

    const dispatchedInput = dispatchSpy.mock.calls[0]?.[0] as {
      resumeRef?: string;
      commandPath?: string;
      commandArgs?: string[];
      dialogId?: string;
    } | undefined;
    expect(dispatchedInput?.resumeRef).toBe('resume-ref');
    expect(dispatchedInput?.commandPath).toBe('/usr/local/bin/codex');
    expect(dispatchedInput?.commandArgs).toEqual(['--flag', '--model', 'gpt-5-codex']);

    const dialogId = String(dispatchedInput?.dialogId ?? '');
    const streamEventsPromise = collectSseEventsWithTimeout(response);

    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', {
      type: 'status',
      payload: { status: 'thinking', detail: 'thinking...' }
    });
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', {
      type: 'assistant_chunk',
      payload: { text: 'Hi from assistant.' }
    });
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', {
      type: 'assistant_done',
      payload: { providerRef: 'session-new', finishReason: 'completed' }
    });

    const events = await streamEventsPromise;
    expect(events.map((item) => item.event)).toEqual([
      'status',
      'status',
      'status',
      'assistant_chunk',
      'assistant_done'
    ]);

    const state = getTerminalAgentDialogState('agent-a', WIDGET_ID, 'codex');
    expect(state.providerSessionRef).toBe('session-new');
    expect(state.status).toBe('done');
    expect(state.lastError).toBeNull();
  });

  it('marks resume_failed flow and closes on error', async () => {
    saveTerminalAgentSettings({
      agentId: 'agent-a',
      widgetId: WIDGET_ID,
      activeProvider: 'gemini',
      codexApiKey: '',
      geminiApiKey: 'gemini-key',
      codexCommand: 'codex',
      codexArgs: [],
      codexModel: 'gpt-5-codex',
      geminiCommand: 'gemini',
      geminiArgs: ['--output-format', 'stream-json'],
      geminiModel: 'gemini-2.5-flash',
      useShellFallback: true,
      shellOverride: 'pwsh'
    });
    upsertTerminalAgentDialogState({
      agentId: 'agent-a',
      widgetId: WIDGET_ID,
      provider: 'gemini',
      providerSessionRef: 'resume-gemini',
      status: 'done',
      lastError: null
    });

    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue({
      agentId: 'runtime-agent',
      sessionId: 'runtime-session',
      hostname: 'host',
      accessJwt: 'token'
    });

    const dispatchSpy = vi
      .spyOn(passportRuntime, 'dispatchTerminalAgentSendMessage')
      .mockReturnValue(true);

    const response = await terminalAgentHandlers['POST message-stream'](
      createContext({
        url: 'http://localhost/api/widget/com.yulia.terminal-agent/message-stream',
        method: 'POST',
        action: 'message-stream',
        body: { provider: 'gemini', message: 'Resume this' }
      })
    );

    expect(response.status).toBe(200);
    await vi.waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });

    const dispatchedInput = dispatchSpy.mock.calls[0]?.[0] as {
      dialogId?: string;
    } | undefined;
    const dialogId = String(dispatchedInput?.dialogId ?? '');
    const streamEventsPromise = collectSseEventsWithTimeout(response);

    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', {
      type: 'resume_failed',
      payload: { reason: 'resume_failed' }
    });
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', {
      type: 'error',
      payload: { message: 'provider_exit_error' }
    });

    const events = await streamEventsPromise;
    expect(events.map((item) => item.event)).toEqual(['status', 'status', 'resume_failed', 'error']);

    const state = getTerminalAgentDialogState('agent-a', WIDGET_ID, 'gemini');
    expect(state.providerSessionRef).toBe('');
    expect(state.status).toBe('error');
    expect(state.lastError).toBe('provider_exit_error');
  });

  it('maps gemini quota noise to single domain-level message', async () => {
    saveTerminalAgentSettings({
      agentId: 'agent-a',
      widgetId: WIDGET_ID,
      activeProvider: 'gemini',
      codexApiKey: '',
      geminiApiKey: 'gemini-key',
      codexCommand: 'codex',
      codexArgs: [],
      codexModel: 'gpt-5-codex',
      geminiCommand: 'gemini',
      geminiArgs: ['--output-format', 'stream-json'],
      geminiModel: 'gemini-2.5-flash',
      useShellFallback: false,
      shellOverride: ''
    });

    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue({
      agentId: 'runtime-agent',
      sessionId: 'runtime-session',
      hostname: 'host',
      accessJwt: 'token'
    });
    const dispatchSpy = vi
      .spyOn(passportRuntime, 'dispatchTerminalAgentSendMessage')
      .mockReturnValue(true);

    const response = await terminalAgentHandlers['POST message-stream'](
      createContext({
        url: 'http://localhost/api/widget/com.yulia.terminal-agent/message-stream',
        method: 'POST',
        action: 'message-stream',
        body: { provider: 'gemini', message: 'Ping quota mapping' }
      })
    );

    expect(response.status).toBe(200);
    await vi.waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });

    const dialogId = String((dispatchSpy.mock.calls[0]?.[0] as { dialogId?: string } | undefined)?.dialogId ?? '');
    const streamEventsPromise = collectSseEventsWithTimeout(response);

    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', {
      type: 'status',
      payload: { status: 'tool_call', detail: 'at classifyGoogleError (file:///path/googleQuotaErrors.js:206:24)' }
    });
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', {
      type: 'status',
      payload: { status: 'tool_call', detail: 'TerminalQuotaError: You have exhausted your daily quota on this model.' }
    });
    moduleBus.publish(`agent:widget:${WIDGET_ID}:${dialogId}`, 'test', {
      type: 'error',
      payload: { message: 'Provider exited with code: 1' }
    });

    const events = await streamEventsPromise;
    expect(events.map((item) => item.event)).toEqual(['status', 'status', 'error']);
    expect(events[1]?.payload).toEqual({
      status: 'tool_call',
      detail: 'Gemini quota exceeded. Check billing/limits and retry later.',
    });
    expect(events[2]?.payload).toEqual({
      message: 'Gemini quota exceeded. Check billing/limits and retry later.',
    });
  });

  it('returns validation/offline errors for message stream entry point', async () => {
    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue(null);

    const offlineResponse = await terminalAgentHandlers['POST message-stream'](
      createContext({
        url: 'http://localhost/api/widget/com.yulia.terminal-agent/message-stream',
        method: 'POST',
        action: 'message-stream',
        body: { provider: 'codex', message: 'Hello' }
      })
    );
    expect(offlineResponse.status).toBe(503);
    expect(await offlineResponse.json()).toEqual({ error: 'agent_offline' });

    const validationResponse = await terminalAgentHandlers['POST message-stream'](
      createContext({
        url: 'http://localhost/api/widget/com.yulia.terminal-agent/message-stream',
        method: 'POST',
        action: 'message-stream',
        body: { provider: 'codex', message: '   ' }
      })
    );
    expect(validationResponse.status).toBe(400);
    expect(await validationResponse.json()).toEqual({ error: 'message is required.' });
  });

  it('handles dispatch failure by emitting agent_offline SSE and marking state as error', async () => {
    vi.spyOn(passportRuntime, 'getOnlineAgentSession').mockReturnValue({
      agentId: 'runtime-agent',
      sessionId: 'runtime-session',
      hostname: 'host',
      accessJwt: 'token'
    });
    vi.spyOn(passportRuntime, 'dispatchTerminalAgentSendMessage').mockReturnValue(false);

    const response = await terminalAgentHandlers['POST message-stream'](
      createContext({
        url: 'http://localhost/api/widget/com.yulia.terminal-agent/message-stream',
        method: 'POST',
        action: 'message-stream',
        body: { provider: 'codex', message: 'Hello' }
      })
    );

    expect(response.status).toBe(200);
    const events = await collectSseEventsWithTimeout(response);
    expect(events.map((item) => item.event)).toEqual(['status', 'error']);
    expect(events[1]?.payload).toEqual({ message: 'agent_offline' });

    const state = getTerminalAgentDialogState('agent-a', WIDGET_ID, 'codex');
    expect(state.status).toBe('error');
    expect(state.lastError).toBe('agent_offline');
  });

  it('returns provider-specific model list from llm catalog service', async () => {
    saveTerminalAgentSettings({
      agentId: 'agent-a',
      widgetId: WIDGET_ID,
      activeProvider: 'codex',
      codexApiKey: 'codex-secret',
      geminiApiKey: 'gemini-secret',
      codexCommand: 'codex',
      codexArgs: [],
      codexModel: 'gpt-5-codex',
      geminiCommand: 'gemini',
      geminiArgs: ['--output-format', 'stream-json'],
      geminiModel: 'gemini-2.5-flash',
      useShellFallback: false,
      shellOverride: '',
    });

    const serviceSpy = vi.spyOn(llmCatalogService, 'getLlmModelCatalog').mockResolvedValue(
      ok({
        provider: 'codex',
        models: ['gpt-5-codex', 'o3'],
        source: 'remote',
        updatedAt: '2026-03-09T10:00:00.000Z',
        stale: false,
      })
    );

    const response = await terminalAgentHandlers['GET models'](
      createContext({
        url: 'http://localhost/api/widget/com.yulia.terminal-agent/models?provider=codex',
        action: 'models',
        actionSegments: ['models'],
      })
    );

    expect(response.status).toBe(200);
    expect(serviceSpy).toHaveBeenCalledWith({
      provider: 'codex',
      apiKey: 'codex-secret',
      forceRefresh: false,
    });
    const payload = await response.json() as Record<string, unknown>;
    expect(payload.items).toEqual([
      { value: 'gpt-5-codex', label: 'gpt-5-codex' },
      { value: 'o3', label: 'o3' },
    ]);
  });

  it('validates models query and maps llm service error', async () => {
    const badRequest = await terminalAgentHandlers['GET models'](
      createContext({
        url: 'http://localhost/api/widget/com.yulia.terminal-agent/models?provider=unknown',
        action: 'models',
        actionSegments: ['models'],
      })
    );
    expect(badRequest.status).toBe(400);

    vi.spyOn(llmCatalogService, 'getLlmModelCatalog').mockResolvedValue(
      err({
        code: 'provider_http_error',
        message: 'upstream failed',
        retryable: true,
      })
    );
    const upstreamFailed = await terminalAgentHandlers['GET models'](
      createContext({
        url: 'http://localhost/api/widget/com.yulia.terminal-agent/models?provider=gemini&refresh=1',
        action: 'models',
        actionSegments: ['models'],
      })
    );
    expect(upstreamFailed.status).toBe(503);
    expect(await upstreamFailed.json()).toEqual({
      error: 'upstream failed',
      code: 'provider_http_error',
    });
  });
});

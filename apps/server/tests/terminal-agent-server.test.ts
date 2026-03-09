import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getTerminalAgentDialogState,
  saveTerminalAgentSettings,
  upsertTerminalAgentDialogState
} from '../src/core/db/terminal-agent-repository';
import { resetDbCache } from '../src/core/db/shared';
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
      geminiCommand: 'gemini',
      geminiArgs: ['--output-format', 'stream-json'],
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
    expect(dispatchedInput?.commandArgs).toEqual(['--flag']);

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
      geminiCommand: 'gemini',
      geminiArgs: ['--output-format', 'stream-json'],
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
    expect(events.map((item) => item.event)).toEqual(['status', 'resume_failed', 'error']);

    const state = getTerminalAgentDialogState('agent-a', WIDGET_ID, 'gemini');
    expect(state.providerSessionRef).toBe('');
    expect(state.status).toBe('error');
    expect(state.lastError).toBe('provider_exit_error');
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
    expect(events.map((item) => item.event)).toEqual(['error']);
    expect(events[0]?.payload).toEqual({ message: 'agent_offline' });

    const state = getTerminalAgentDialogState('agent-a', WIDGET_ID, 'codex');
    expect(state.status).toBe('error');
    expect(state.lastError).toBe('agent_offline');
  });
});

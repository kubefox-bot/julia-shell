import { describe, expect, it, vi } from 'vitest';
import { PassportRuntime } from '../src/domains/passport/server/runtime/runtime';
import { TERMINAL_AGENT_WIDGET_ID, TRANSCRIBE_WIDGET_ID } from '../src/widgets';

type RuntimeLike = {
  resolveWidgetEvent: (envelope: Record<string, unknown>) => {
    widgetId: string;
    eventType: string;
    payload: unknown;
  } | null;
  connections: Map<string, {
    agentId: string;
    sessionId: string;
    call: { write: (payload: unknown) => void };
    lastSeenAtMs: number;
    hostname: string | null;
    accessJwt: string;
  }>;
  dispatchTranscribeStart: (input: {
    agentId: string;
    sessionId: string;
    jobId: string;
    folderPath: string;
    filePaths: string[];
  }) => boolean;
  dispatchTerminalAgentSendMessage: (input: {
    agentId: string;
    sessionId: string;
    dialogId: string;
    provider: 'codex' | 'gemini';
    message: string;
    commandPath: string;
    commandArgs: string[];
    useShellFallback: boolean;
  }) => boolean;
};

describe('passport runtime protocol compatibility', () => {
  it('resolves legacy transcribe top-level payloads', () => {
    const runtime = new PassportRuntime() as unknown as RuntimeLike;

    const resolved = runtime.resolveWidgetEvent({
      progress: { percent: 42, stage: 'progressTranscribing' }
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.widgetId).toBe(TRANSCRIBE_WIDGET_ID);
    expect(resolved?.eventType).toBe('progress');
    expect(resolved?.payload).toEqual({ percent: 42, stage: 'progressTranscribing' });
  });

  it('dispatches transcribe command via legacy top-level field', () => {
    const runtime = new PassportRuntime() as unknown as RuntimeLike;
    const write = vi.fn();
    runtime.connections.set('agent-a', {
      agentId: 'agent-a',
      sessionId: 'session-a',
      call: { write },
      lastSeenAtMs: Date.now(),
      hostname: null,
      accessJwt: 'jwt',
    });

    const dispatched = runtime.dispatchTranscribeStart({
      agentId: 'agent-a',
      sessionId: 'session-a',
      jobId: 'job-a',
      folderPath: '/tmp',
      filePaths: ['/tmp/a.opus'],
    });

    expect(dispatched).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    const payload = write.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.transcribeStart).toEqual({
      folderPath: '/tmp',
      filePaths: ['/tmp/a.opus'],
    });
    expect(payload.widgetCommand).toBeUndefined();
  });

  it('dispatches terminal agent command via widget_command', () => {
    const runtime = new PassportRuntime() as unknown as RuntimeLike;
    const write = vi.fn();
    runtime.connections.set('agent-a', {
      agentId: 'agent-a',
      sessionId: 'session-a',
      call: { write },
      lastSeenAtMs: Date.now(),
      hostname: null,
      accessJwt: 'jwt',
    });

    const dispatched = runtime.dispatchTerminalAgentSendMessage({
      agentId: 'agent-a',
      sessionId: 'session-a',
      dialogId: 'dialog-a',
      provider: 'gemini',
      message: 'ping',
      commandPath: 'gemini',
      commandArgs: [],
      useShellFallback: false,
    });

    expect(dispatched).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    const payload = write.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.transcribeStart).toBeUndefined();
    expect(payload.widgetCommand).toMatchObject({
      widgetId: TERMINAL_AGENT_WIDGET_ID,
      terminalAgentSendMessage: {
        message: 'ping',
      }
    });
  });
});

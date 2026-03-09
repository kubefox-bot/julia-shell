import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDbCache } from '../src/core/db/shared';
import { PassportRuntime } from '../src/domains/passport/server/runtime/runtime';
import { moduleBus } from '../src/shared/lib/module-bus';

type RuntimeInternals = {
  publishWidgetPayload: (input: {
    agentId: string;
    sessionId: string;
    jobId: string;
    widgetId: string;
    eventType: string;
    payload: unknown;
  }) => void;
};

let tempDir = '';

describe('passport runtime widget bus transport', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-passport-runtime-bus-'));
    process.env.JULIAAPP_DATA_DIR = tempDir;
  });

  afterEach(() => {
    resetDbCache();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.JULIAAPP_DATA_DIR;
  });

  it('publishes transcribe events only to unified widget topic', () => {
    const runtime = new PassportRuntime() as unknown as RuntimeInternals;
    const topics: string[] = [];
    const unsubscribe = moduleBus.subscribe('*', (event) => {
      topics.push(event.topic);
    });

    runtime.publishWidgetPayload({
      agentId: 'agent-a',
      sessionId: 'session-a',
      jobId: 'job-a',
      widgetId: 'com.yulia.transcribe',
      eventType: 'progress',
      payload: { percent: 10 }
    });
    unsubscribe();

    expect(topics).toContain('agent:widget:com.yulia.transcribe:job-a');
    expect(topics).not.toContain('agent:transcribe:job-a');
  });
});

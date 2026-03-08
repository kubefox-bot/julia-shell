import path from 'node:path';
import {
  appendTranscribeOutboxEvent,
  completeTranscribeJob,
  createTranscribeJob,
  failTranscribeJob,
  touchRecentFolder,
  updateTranscribeJobProgress,
} from '../../../core/db/transcribe-repository';
import { agentRuntime } from '../../../core/agent/runtime';
import { jsonResponse } from '../../../shared/lib/http';
import { moduleBus } from '../../../shared/lib/module-bus';
import { DEFAULT_GEMINI_MODEL, WIDGET_ID } from './constants';
import { resolveSelection, toSseEvent } from './utils';

type AgentEventPayload = {
  type?: string;
  payload?: Record<string, unknown>;
};

export async function handleAgentTranscribeStream(
  body: { folderPath?: string; filePath?: string; filePaths?: string[] },
  request: Request,
) {
  const folderPath = typeof body.folderPath === 'string' ? body.folderPath.trim() : '';
  const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : '';
  const filePaths = Array.isArray(body.filePaths) ? body.filePaths : [];

  if (!folderPath && !filePath && filePaths.length === 0) {
    return jsonResponse({ error: 'folderPath or filePaths is required.' }, 400);
  }

  const onlineAgent = agentRuntime.getOnlineAgentSession();
  if (!onlineAgent) {
    return jsonResponse({ error: 'agent_offline' }, 503);
  }

  const selection = await resolveSelection(folderPath, filePath, filePaths);
  const { filePaths: selectedFiles, canonicalSourceFile, resolvedFolderPath } = selection;

  touchRecentFolder(WIDGET_ID, resolvedFolderPath);

  const jobId = createTranscribeJob({
    widgetId: WIDGET_ID,
    folderPath: resolvedFolderPath,
    filePaths: selectedFiles,
    primarySourceFile: canonicalSourceFile,
    platform: 'windows',
    model: DEFAULT_GEMINI_MODEL,
  });

  appendTranscribeOutboxEvent({
    widgetId: WIDGET_ID,
    jobId,
    eventType: 'job_created',
    state: 'queued',
    payload: {
      folderPath: resolvedFolderPath,
      filePaths: selectedFiles,
      mode: 'agent',
      agentId: onlineAgent.agentId,
    },
  });

  const topic = `agent:transcribe:${jobId}`;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, payload: Record<string, unknown>) => {
        if (closed) {
          return;
        }

        controller.enqueue(encoder.encode(toSseEvent(event, payload)));
      };

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        try {
          controller.close();
        } catch {
          // ignored
        }
      };

      send('progress', {
        percent: 2,
        stage: 'progressJobCreated',
        jobId,
      });

      const off = moduleBus.subscribe(topic, (event) => {
        const payload = (event.payload ?? {}) as AgentEventPayload;
        const eventType = payload.type ?? '';

        if (eventType === 'progress') {
          const percent = Number(payload.payload?.percent ?? 0);
          const stage = String(payload.payload?.stage ?? 'progress');
          updateTranscribeJobProgress(jobId, percent);
          send('progress', { percent, stage, jobId });
          return;
        }

        if (eventType === 'token') {
          const text = String(payload.payload?.text ?? '');
          if (text) {
            send('token', { text, jobId, model: 'agent' });
          }
          return;
        }

        if (eventType === 'done') {
          const transcript = String(payload.payload?.transcript ?? '');
          const savePath = String(
            payload.payload?.savePath ??
              path.join(resolvedFolderPath, `${path.parse(canonicalSourceFile).name}.txt`),
          );
          completeTranscribeJob(jobId, savePath);
          appendTranscribeOutboxEvent({
            widgetId: WIDGET_ID,
            jobId,
            eventType: 'transcription_completed',
            state: 'completed',
            payload: {
              sourceFile: canonicalSourceFile,
              savePath,
              model: 'agent',
            },
          });
          send('done', {
            status: 'ready',
            sourceFile: canonicalSourceFile,
            savePath,
            transcript,
            model: 'agent',
            jobId,
          });
          off();
          close();
          return;
        }

        if (eventType === 'error') {
          const message = String(payload.payload?.message ?? 'Agent transcription failed.');
          failTranscribeJob(jobId, message);
          appendTranscribeOutboxEvent({
            widgetId: WIDGET_ID,
            jobId,
            eventType: 'job_failed',
            state: 'failed',
            payload: { message },
          });
          send('error', { message, jobId });
          off();
          close();
        }
      });

      const dispatched = agentRuntime.dispatchTranscribeStart({
        agentId: onlineAgent.agentId,
        sessionId: onlineAgent.sessionId,
        jobId,
        folderPath: resolvedFolderPath,
        filePaths: selectedFiles,
      });

      if (!dispatched) {
        off();
        failTranscribeJob(jobId, 'Agent dispatch failed: session is unavailable.');
        send('error', { message: 'agent_offline', jobId });
        close();
      }

      request.signal.addEventListener('abort', () => {
        off();
        close();
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

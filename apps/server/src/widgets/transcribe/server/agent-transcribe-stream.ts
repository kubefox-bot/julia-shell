import {
  appendTranscribeOutboxEvent,
  createTranscribeJob,
  failTranscribeJob,
  touchRecentFolder,
} from './repository';
import { passportRuntime } from '@passport/server/runtime';
import { jsonResponse } from '@shared/lib/http';
import { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_OK, HTTP_STATUS_SERVICE_UNAVAILABLE } from '@shared/lib/http-status';
import { moduleBus } from '@shared/lib/module-bus';
import { DEFAULT_GEMINI_MODEL, WIDGET_ID } from './constants';
import { TRANSCRIBE_PROGRESS_JOB_CREATED_PERCENT } from '../progress';
import { handleAgentBusEvent, type AgentEventPayload } from './agent-transcribe-events';
import { isTranscribeDevBypassMode } from './agent-mode';
import { resolveSelection, toSseEvent } from './utils';

function deriveFolderPath(input: { folderPath: string; canonicalSourceFile: string }) {
  const explicit = input.folderPath.trim();
  if (explicit) {
    return explicit;
  }

  const source = input.canonicalSourceFile.trim();
  const separatorIndex = Math.max(source.lastIndexOf('/'), source.lastIndexOf('\\'));
  if (separatorIndex <= 0) {
    return '.';
  }

  return source.slice(0, separatorIndex);
}

export async function handleAgentTranscribeStream(
  body: { folderPath?: string; filePath?: string; filePaths?: string[] },
  request: Request,
  agentId: string,
) {
  const folderPathRaw = typeof body.folderPath === 'string' ? body.folderPath.trim() : '';
  const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : '';
  const filePaths = Array.isArray(body.filePaths) ? body.filePaths : [];
  const useServerSelection = isTranscribeDevBypassMode();

  const onlineAgent = passportRuntime.getOnlineAgentSession(agentId);
  if (!onlineAgent) {
    return jsonResponse({ error: 'agent_offline' }, HTTP_STATUS_SERVICE_UNAVAILABLE);
  }

  let selectedFiles: string[] = [];
  let canonicalSourceFile = '';
  let resolvedFolderPath = '';

  if (useServerSelection) {
    const selection = await resolveSelection(folderPathRaw, filePath, filePaths);
    selectedFiles = selection.filePaths;
    canonicalSourceFile = selection.canonicalSourceFile;
    resolvedFolderPath = selection.resolvedFolderPath;
  } else {
    selectedFiles = (filePaths.length > 0 ? filePaths : filePath ? [filePath] : [])
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);

    if (selectedFiles.length === 0) {
      return jsonResponse(
        { error: 'filePath or filePaths is required for agent-side selection.' },
        HTTP_STATUS_BAD_REQUEST
      );
    }

    canonicalSourceFile = selectedFiles[0];
    resolvedFolderPath = deriveFolderPath({
      folderPath: folderPathRaw,
      canonicalSourceFile,
    });
  }

  touchRecentFolder(agentId, WIDGET_ID, resolvedFolderPath);

  const jobId = createTranscribeJob({
    agentId,
    widgetId: WIDGET_ID,
    folderPath: resolvedFolderPath,
    filePaths: selectedFiles,
    primarySourceFile: canonicalSourceFile,
    platform: 'windows',
    model: DEFAULT_GEMINI_MODEL,
  });

  appendTranscribeOutboxEvent({
    agentId,
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

  const topic = `agent:widget:${WIDGET_ID}:${jobId}`;
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
        percent: TRANSCRIBE_PROGRESS_JOB_CREATED_PERCENT,
        stage: 'progressJobCreated',
        jobId,
      });

      const off = moduleBus.subscribe(topic, (event) => {
        handleAgentBusEvent({
          eventPayload: (event.payload ?? {}) as AgentEventPayload,
          handlers: { send, close, off },
          agentId,
          jobId,
          canonicalSourceFile,
          resolvedFolderPath,
        });
      });

      const dispatched = passportRuntime.dispatchTranscribeStart({
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
    status: HTTP_STATUS_OK,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

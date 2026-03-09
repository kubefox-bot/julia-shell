import { randomUUID } from 'node:crypto';
import type { HostPlatform } from '../../entities/widget/model/types';
import { nowIso } from '@shared/lib/time';
import { openDb } from './shared';
import { nextRecentFolderTimestamp, normalizeSpeakerKey } from './transcribe-helpers';

export type TranscribeJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type TranscribeOutboxEventType =
  | 'audio_selected'
  | 'job_created'
  | 'processing_started'
  | 'transcription_completed'
  | 'file_created'
  | 'transcript_opened'
  | 'job_failed';

export type CreateTranscribeJobInput = {
  agentId: string;
  widgetId: string;
  folderPath: string;
  filePaths: string[];
  primarySourceFile: string;
  platform: HostPlatform;
  model: string;
};

export type TranscribeWidgetSettings = {
  agentId: string;
  widgetId: string;
  geminiModel: string;
  localApiKey: string;
  updatedAt: string | null;
};

export type TranscribeSpeakerAlias = {
  speakerKey: string;
  aliasName: string;
};

const MAX_PROGRESS_PERCENT = 100;

function hasColumn(db: ReturnType<typeof openDb>, tableName: string, columnName: string) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function maybeResetLegacySchema(db: ReturnType<typeof openDb>) {
  const resetJobs = !hasColumn(db, 'transcribe_jobs', 'agent_id');
  const resetOutbox = !hasColumn(db, 'transcribe_outbox', 'agent_id');
  const resetSettings = !hasColumn(db, 'transcribe_widget_settings', 'agent_id');
  const resetRecent = !hasColumn(db, 'transcribe_recent_folders', 'agent_id');
  const resetAliases = !hasColumn(db, 'transcribe_speaker_aliases', 'agent_id');

  if (resetJobs) {
    db.exec('DROP TABLE IF EXISTS transcribe_jobs;');
  }
  if (resetOutbox) {
    db.exec('DROP TABLE IF EXISTS transcribe_outbox;');
  }
  if (resetSettings) {
    db.exec('DROP TABLE IF EXISTS transcribe_widget_settings;');
  }
  if (resetRecent) {
    db.exec('DROP TABLE IF EXISTS transcribe_recent_folders;');
  }
  if (resetAliases) {
    db.exec('DROP TABLE IF EXISTS transcribe_speaker_aliases;');
  }
}

function bootstrap() {
  const db = openDb('transcribe.db');
  maybeResetLegacySchema(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS transcribe_jobs (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      widget_id TEXT NOT NULL DEFAULT 'com.yulia.transcribe',
      folder_path TEXT NOT NULL,
      file_paths_json TEXT NOT NULL,
      primary_source_file TEXT,
      source_file TEXT,
      save_path TEXT,
      platform TEXT NOT NULL DEFAULT 'windows',
      model TEXT,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transcribe_outbox (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      job_id TEXT,
      widget_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      state TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transcribe_widget_settings (
      agent_id TEXT NOT NULL,
      widget_id TEXT NOT NULL,
      gemini_model TEXT,
      local_api_key TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, widget_id)
    );

    CREATE TABLE IF NOT EXISTS transcribe_recent_folders (
      agent_id TEXT NOT NULL,
      widget_id TEXT NOT NULL,
      folder_path TEXT NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, widget_id, folder_path)
    );

    CREATE TABLE IF NOT EXISTS transcribe_speaker_aliases (
      agent_id TEXT NOT NULL,
      widget_id TEXT NOT NULL,
      speaker_key TEXT NOT NULL,
      alias_name TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, widget_id, speaker_key)
    );

    CREATE INDEX IF NOT EXISTS idx_transcribe_jobs_agent_created_at ON transcribe_jobs(agent_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transcribe_jobs_agent_status ON transcribe_jobs(agent_id, status);
    CREATE INDEX IF NOT EXISTS idx_transcribe_outbox_agent_job_created ON transcribe_outbox(agent_id, job_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transcribe_recent_folders_rank ON transcribe_recent_folders(agent_id, widget_id, last_used_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transcribe_speaker_aliases_widget ON transcribe_speaker_aliases(agent_id, widget_id);
  `);

  return db;
}

function getDb() {
  return bootstrap();
}

export function createTranscribeJob(input: CreateTranscribeJobInput) {
  const db = getDb();
  const id = randomUUID();
  const now = nowIso();

  db.prepare(`
    INSERT INTO transcribe_jobs (
      id,
      agent_id,
      widget_id,
      folder_path,
      file_paths_json,
      primary_source_file,
      source_file,
      platform,
      model,
      status,
      progress,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?)
  `).run(
    id,
    input.agentId,
    input.widgetId,
    input.folderPath,
    JSON.stringify(input.filePaths),
    input.primarySourceFile,
    input.primarySourceFile,
    input.platform,
    input.model,
    now,
    now
  );

  return id;
}

export function updateTranscribeJobProgress(id: string, progress: number, status: TranscribeJobStatus = 'processing') {
  const db = getDb();
  db.prepare(`
    UPDATE transcribe_jobs
    SET status = ?,
        progress = ?,
        updated_at = ?
    WHERE id = ?
  `).run(status, Math.max(0, Math.min(MAX_PROGRESS_PERCENT, Math.round(progress))), nowIso(), id);
}

export function completeTranscribeJob(id: string, savePath: string) {
  const db = getDb();
  db.prepare(`
    UPDATE transcribe_jobs
    SET status = 'completed',
        progress = 100,
        save_path = ?,
        error_message = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(savePath, nowIso(), id);
}

export function failTranscribeJob(id: string, errorMessage: string) {
  const db = getDb();
  db.prepare(`
    UPDATE transcribe_jobs
    SET status = 'failed',
        error_message = ?,
        updated_at = ?
    WHERE id = ?
  `).run(errorMessage, nowIso(), id);
}

export function appendTranscribeOutboxEvent(input: {
  agentId: string;
  widgetId: string;
  jobId?: string | null;
  eventType: TranscribeOutboxEventType;
  state: string;
  payload?: Record<string, unknown>;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO transcribe_outbox (
      id,
      agent_id,
      job_id,
      widget_id,
      event_type,
      state,
      payload_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    input.agentId,
    input.jobId ?? null,
    input.widgetId,
    input.eventType,
    input.state,
    JSON.stringify(input.payload ?? {}),
    nowIso()
  );
}

export function listRecentTranscribeJobs(agentId: string, limit = 20) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      id,
      agent_id as agentId,
      widget_id as widgetId,
      folder_path as folderPath,
      file_paths_json as filePathsJson,
      primary_source_file as primarySourceFile,
      save_path as savePath,
      platform,
      model,
      status,
      progress,
      error_message as errorMessage,
      created_at as createdAt,
      updated_at as updatedAt
    FROM transcribe_jobs
    WHERE agent_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(agentId, limit) as Array<{
    id: string;
    agentId: string;
    widgetId: string;
    folderPath: string;
    filePathsJson: string;
    primarySourceFile: string | null;
    savePath: string | null;
    platform: HostPlatform;
    model: string | null;
    status: TranscribeJobStatus;
    progress: number;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }>;

  return rows.map((row) => ({
    ...row,
    filePaths: JSON.parse(row.filePathsJson) as string[]
  }));
}

export function getTranscribeWidgetSettings(agentId: string, widgetId: string): TranscribeWidgetSettings {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      agent_id as agentId,
      widget_id as widgetId,
      gemini_model as geminiModel,
      local_api_key as localApiKey,
      updated_at as updatedAt
    FROM transcribe_widget_settings
    WHERE agent_id = ? AND widget_id = ?
  `).get(agentId, widgetId) as {
    agentId: string;
    widgetId: string;
    geminiModel: string | null;
    localApiKey: string | null;
    updatedAt: string;
  } | undefined;

  return {
    agentId,
    widgetId,
    geminiModel: row?.geminiModel?.trim() ?? '',
    localApiKey: row?.localApiKey?.trim() ?? '',
    updatedAt: row?.updatedAt ?? null
  };
}

export function saveTranscribeWidgetSettings(input: {
  agentId: string;
  widgetId: string;
  geminiModel: string;
  localApiKey?: string;
}) {
  const db = getDb();
  const now = nowIso();
  const current = getTranscribeWidgetSettings(input.agentId, input.widgetId);

  db.prepare(`
    INSERT INTO transcribe_widget_settings (
      agent_id,
      widget_id,
      gemini_model,
      local_api_key,
      updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(agent_id, widget_id) DO UPDATE SET
      gemini_model = excluded.gemini_model,
      local_api_key = excluded.local_api_key,
      updated_at = excluded.updated_at
  `).run(
    input.agentId,
    input.widgetId,
    input.geminiModel.trim(),
    typeof input.localApiKey === 'string' ? input.localApiKey.trim() : current.localApiKey,
    now
  );

  return getTranscribeWidgetSettings(input.agentId, input.widgetId);
}

export function touchRecentFolder(agentId: string, widgetId: string, folderPath: string) {
  const db = getDb();
  const normalizedPath = folderPath.trim();
  if (!normalizedPath) {
    return;
  }

  const transaction = db.transaction(() => {
    const timestamp = nextRecentFolderTimestamp();

    db.prepare(`
      INSERT INTO transcribe_recent_folders (
        agent_id,
        widget_id,
        folder_path,
        use_count,
        last_used_at
      ) VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(agent_id, widget_id, folder_path) DO UPDATE SET
        last_used_at = excluded.last_used_at
    `).run(agentId, widgetId, normalizedPath, timestamp);

    db.prepare(`
      DELETE FROM transcribe_recent_folders
      WHERE agent_id = ?
        AND widget_id = ?
        AND folder_path NOT IN (
          SELECT folder_path
          FROM transcribe_recent_folders
          WHERE agent_id = ?
            AND widget_id = ?
          ORDER BY last_used_at DESC
          LIMIT 5
        )
    `).run(agentId, widgetId, agentId, widgetId);
  });

  transaction();
}

export function listRecentFolders(agentId: string, widgetId: string, limit = 5) {
  const db = getDb();
  return db.prepare(`
    SELECT folder_path as folderPath
    FROM transcribe_recent_folders
    WHERE agent_id = ? AND widget_id = ?
    ORDER BY last_used_at DESC
    LIMIT ?
  `).all(agentId, widgetId, limit) as Array<{ folderPath: string }>;
}

export function listSpeakerAliases(agentId: string, widgetId: string): TranscribeSpeakerAlias[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      speaker_key as speakerKey,
      alias_name as aliasName
    FROM transcribe_speaker_aliases
    WHERE agent_id = ? AND widget_id = ?
    ORDER BY speaker_key ASC
  `).all(agentId, widgetId) as TranscribeSpeakerAlias[];
}

export function saveSpeakerAliases(agentId: string, widgetId: string, aliases: TranscribeSpeakerAlias[]) {
  const db = getDb();
  const transaction = db.transaction(() => {
    for (const entry of aliases) {
      const speakerKey = normalizeSpeakerKey(entry.speakerKey);
      if (!speakerKey) {
        continue;
      }

      const aliasName = entry.aliasName.trim();
      if (!aliasName) {
        db.prepare(`
          DELETE FROM transcribe_speaker_aliases
          WHERE agent_id = ?
            AND widget_id = ?
            AND speaker_key = ?
        `).run(agentId, widgetId, speakerKey);
        continue;
      }

      db.prepare(`
        INSERT INTO transcribe_speaker_aliases (
          agent_id,
          widget_id,
          speaker_key,
          alias_name,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(agent_id, widget_id, speaker_key) DO UPDATE SET
          alias_name = excluded.alias_name,
          updated_at = excluded.updated_at
      `).run(agentId, widgetId, speakerKey, aliasName, nowIso());
    }
  });

  transaction();
  return listSpeakerAliases(agentId, widgetId);
}

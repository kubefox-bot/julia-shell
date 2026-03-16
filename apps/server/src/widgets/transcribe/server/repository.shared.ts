import type { HostPlatform } from '../../../entities/widget/model/types'
import { openDb } from '../../../core/db/shared'

export type TranscribeJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export type TranscribeOutboxEventType =
  | 'audio_selected'
  | 'job_created'
  | 'processing_started'
  | 'transcription_completed'
  | 'file_created'
  | 'transcript_opened'
  | 'job_failed'

export type CreateTranscribeJobInput = {
  agentId: string
  widgetId: string
  folderPath: string
  filePaths: string[]
  primarySourceFile: string
  platform: HostPlatform
  model: string
}

export type TranscribeWidgetSettings = {
  agentId: string
  widgetId: string
  geminiModel: string
  localApiKey: string
  updatedAt: string | null
}

export type TranscribeSpeakerAlias = {
  speakerKey: string
  aliasName: string
}

function hasColumn(db: ReturnType<typeof openDb>, tableName: string, columnName: string) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  return rows.some((row) => row.name === columnName)
}

function maybeResetLegacySchema(db: ReturnType<typeof openDb>) {
  const resetJobs = !hasColumn(db, 'transcribe_jobs', 'agent_id')
  const resetOutbox = !hasColumn(db, 'transcribe_outbox', 'agent_id')
  const resetSettings = !hasColumn(db, 'transcribe_widget_settings', 'agent_id')
  const resetRecent = !hasColumn(db, 'transcribe_recent_folders', 'agent_id')
  const resetAliases = !hasColumn(db, 'transcribe_speaker_aliases', 'agent_id')

  if (resetJobs) {
    db.exec('DROP TABLE IF EXISTS transcribe_jobs;')
  }
  if (resetOutbox) {
    db.exec('DROP TABLE IF EXISTS transcribe_outbox;')
  }
  if (resetSettings) {
    db.exec('DROP TABLE IF EXISTS transcribe_widget_settings;')
  }
  if (resetRecent) {
    db.exec('DROP TABLE IF EXISTS transcribe_recent_folders;')
  }
  if (resetAliases) {
    db.exec('DROP TABLE IF EXISTS transcribe_speaker_aliases;')
  }
}

function bootstrap() {
  const db = openDb('transcribe.db')
  maybeResetLegacySchema(db)

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
  `)

  return db
}

export function getTranscribeDb() {
  return bootstrap()
}

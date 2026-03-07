import { randomUUID } from 'node:crypto'
import type { HostPlatform } from '../../entities/widget/model/types'
import { nowIso } from '../../shared/lib/time'
import { openDb } from './shared'

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
  widgetId: string
  folderPath: string
  filePaths: string[]
  primarySourceFile: string
  platform: HostPlatform
  model: string
}

export type TranscribeWidgetSettings = {
  widgetId: string
  geminiModel: string
  localApiKey: string
  updatedAt: string | null
}

let recentFolderTouchSequence = 0

function nextRecentFolderTimestamp() {
  const value = new Date(Date.now() + recentFolderTouchSequence).toISOString()
  recentFolderTouchSequence += 1
  return value
}

function ensureTranscribeJobsColumns() {
  const db = openDb('transcribe.db')
  const rows = db.prepare('PRAGMA table_info(transcribe_jobs)').all() as Array<{ name: string }>
  const columnNames = new Set(rows.map((row) => row.name))

  const addColumn = (name: string, definition: string) => {
    if (!columnNames.has(name)) {
      db.exec(`ALTER TABLE transcribe_jobs ADD COLUMN ${name} ${definition}`)
    }
  }

  addColumn('widget_id', "TEXT NOT NULL DEFAULT 'com.yulia.transcribe'")
  addColumn('primary_source_file', 'TEXT')
  addColumn('platform', "TEXT NOT NULL DEFAULT 'windows'")
  addColumn('model', 'TEXT')
  addColumn('source_file', 'TEXT')
}

function bootstrap() {
  const db = openDb('transcribe.db')
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcribe_jobs (
      id TEXT PRIMARY KEY,
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
      job_id TEXT,
      widget_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      state TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transcribe_widget_settings (
      widget_id TEXT PRIMARY KEY,
      gemini_model TEXT,
      local_api_key TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transcribe_recent_folders (
      widget_id TEXT NOT NULL,
      folder_path TEXT NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT NOT NULL,
      PRIMARY KEY (widget_id, folder_path)
    );

    CREATE INDEX IF NOT EXISTS idx_transcribe_jobs_created_at ON transcribe_jobs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transcribe_jobs_status ON transcribe_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_transcribe_outbox_job_created ON transcribe_outbox(job_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transcribe_recent_folders_rank ON transcribe_recent_folders(widget_id, last_used_at DESC);
  `)

  ensureTranscribeJobsColumns()
  return db
}

function getDb() {
  return bootstrap()
}

export function createTranscribeJob(input: CreateTranscribeJobInput) {
  const db = getDb()
  const id = randomUUID()
  const now = nowIso()

  db.prepare(`
    INSERT INTO transcribe_jobs (
      id,
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?)
  `).run(
    id,
    input.widgetId,
    input.folderPath,
    JSON.stringify(input.filePaths),
    input.primarySourceFile,
    input.primarySourceFile,
    input.platform,
    input.model,
    now,
    now
  )

  return id
}

export function updateTranscribeJobProgress(id: string, progress: number, status: TranscribeJobStatus = 'processing') {
  const db = getDb()
  db.prepare(`
    UPDATE transcribe_jobs
    SET status = ?,
        progress = ?,
        updated_at = ?
    WHERE id = ?
  `).run(status, Math.max(0, Math.min(100, Math.round(progress))), nowIso(), id)
}

export function completeTranscribeJob(id: string, savePath: string) {
  const db = getDb()
  db.prepare(`
    UPDATE transcribe_jobs
    SET status = 'completed',
        progress = 100,
        save_path = ?,
        error_message = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(savePath, nowIso(), id)
}

export function failTranscribeJob(id: string, errorMessage: string) {
  const db = getDb()
  db.prepare(`
    UPDATE transcribe_jobs
    SET status = 'failed',
        error_message = ?,
        updated_at = ?
    WHERE id = ?
  `).run(errorMessage, nowIso(), id)
}

export function appendTranscribeOutboxEvent(input: {
  widgetId: string
  jobId?: string | null
  eventType: TranscribeOutboxEventType
  state: string
  payload?: Record<string, unknown>
}) {
  const db = getDb()
  db.prepare(`
    INSERT INTO transcribe_outbox (
      id,
      job_id,
      widget_id,
      event_type,
      state,
      payload_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    input.jobId ?? null,
    input.widgetId,
    input.eventType,
    input.state,
    JSON.stringify(input.payload ?? {}),
    nowIso()
  )
}

export function listRecentTranscribeJobs(limit = 20) {
  const db = getDb()
  const rows = db.prepare(`
    SELECT
      id,
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
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: string
    widgetId: string
    folderPath: string
    filePathsJson: string
    primarySourceFile: string | null
    savePath: string | null
    platform: HostPlatform
    model: string | null
    status: TranscribeJobStatus
    progress: number
    errorMessage: string | null
    createdAt: string
    updatedAt: string
  }>

  return rows.map((row) => ({
    ...row,
    filePaths: JSON.parse(row.filePathsJson) as string[]
  }))
}

export function getTranscribeWidgetSettings(widgetId: string): TranscribeWidgetSettings {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      widget_id as widgetId,
      gemini_model as geminiModel,
      local_api_key as localApiKey,
      updated_at as updatedAt
    FROM transcribe_widget_settings
    WHERE widget_id = ?
  `).get(widgetId) as {
    widgetId: string
    geminiModel: string | null
    localApiKey: string | null
    updatedAt: string
  } | undefined

  return {
    widgetId,
    geminiModel: row?.geminiModel?.trim() ?? '',
    localApiKey: row?.localApiKey?.trim() ?? '',
    updatedAt: row?.updatedAt ?? null
  }
}

export function saveTranscribeWidgetSettings(input: {
  widgetId: string
  geminiModel: string
  localApiKey?: string
}) {
  const db = getDb()
  const now = nowIso()
  const current = getTranscribeWidgetSettings(input.widgetId)

  db.prepare(`
    INSERT INTO transcribe_widget_settings (
      widget_id,
      gemini_model,
      local_api_key,
      updated_at
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(widget_id) DO UPDATE SET
      gemini_model = excluded.gemini_model,
      local_api_key = excluded.local_api_key,
      updated_at = excluded.updated_at
  `).run(
    input.widgetId,
    input.geminiModel.trim(),
    typeof input.localApiKey === 'string' ? input.localApiKey.trim() : current.localApiKey,
    now
  )

  return getTranscribeWidgetSettings(input.widgetId)
}

export function touchRecentFolder(widgetId: string, folderPath: string) {
  const db = getDb()
  const normalizedPath = folderPath.trim()
  if (!normalizedPath) {
    return
  }
  const transaction = db.transaction(() => {
    const timestamp = nextRecentFolderTimestamp()

    db.prepare(`
      INSERT INTO transcribe_recent_folders (
        widget_id,
        folder_path,
        use_count,
        last_used_at
      ) VALUES (?, ?, 1, ?)
      ON CONFLICT(widget_id, folder_path) DO UPDATE SET
        last_used_at = excluded.last_used_at
    `).run(widgetId, normalizedPath, timestamp)

    db.prepare(`
      DELETE FROM transcribe_recent_folders
      WHERE widget_id = ?
        AND folder_path NOT IN (
        SELECT folder_path
        FROM transcribe_recent_folders
        WHERE widget_id = ?
        ORDER BY last_used_at DESC
        LIMIT 5
      )
    `).run(widgetId, widgetId)
  })

  transaction()
}

export function listRecentFolders(widgetId: string, limit = 5) {
  const db = getDb()
  return db.prepare(`
    SELECT folder_path as folderPath
    FROM transcribe_recent_folders
    WHERE widget_id = ?
    ORDER BY last_used_at DESC
    LIMIT ?
  `).all(widgetId, limit) as Array<{ folderPath: string }>
}

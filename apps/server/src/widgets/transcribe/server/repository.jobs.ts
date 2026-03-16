import { randomUUID } from 'node:crypto'
import type { HostPlatform } from '../../../entities/widget/model/types'
import { nowIso } from '@shared/lib/time'
import { getTranscribeDb, type CreateTranscribeJobInput, type TranscribeJobStatus, type TranscribeOutboxEventType } from './repository.shared'

const JOB_PROGRESS_MIN = Number('0')
const JOB_PROGRESS_MAX = Number('100')
const RECENT_JOBS_LIMIT = Number('20')
const JOB_STATUS_COMPLETED_PROGRESS = Number('100')

export function createTranscribeJob(input: CreateTranscribeJobInput) {
  const db = getTranscribeDb()
  const id = randomUUID()
  const now = nowIso()

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
    now,
  )

  return id
}

function clampJobProgress(progress: number) {
  return Math.max(JOB_PROGRESS_MIN, Math.min(JOB_PROGRESS_MAX, Math.round(progress)))
}

export function updateTranscribeJobProgress(id: string, progress: number, status: TranscribeJobStatus = 'processing') {
  const db = getTranscribeDb()
  db.prepare(`
    UPDATE transcribe_jobs
    SET status = ?,
        progress = ?,
        updated_at = ?
    WHERE id = ?
  `).run(status, clampJobProgress(progress), nowIso(), id)
}

export function completeTranscribeJob(id: string, savePath: string) {
  const db = getTranscribeDb()
  db.prepare(`
    UPDATE transcribe_jobs
    SET status = 'completed',
        progress = ?,
        save_path = ?,
        error_message = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(JOB_STATUS_COMPLETED_PROGRESS, savePath, nowIso(), id)
}

export function failTranscribeJob(id: string, errorMessage: string) {
  const db = getTranscribeDb()
  db.prepare(`
    UPDATE transcribe_jobs
    SET status = 'failed',
        error_message = ?,
        updated_at = ?
    WHERE id = ?
  `).run(errorMessage, nowIso(), id)
}

export function appendTranscribeOutboxEvent(input: {
  agentId: string
  widgetId: string
  jobId?: string | null
  eventType: TranscribeOutboxEventType
  state: string
  payload?: Record<string, unknown>
}) {
  const db = getTranscribeDb()
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
    nowIso(),
  )
}

export function listRecentTranscribeJobs(agentId: string, limit = RECENT_JOBS_LIMIT) {
  const db = getTranscribeDb()
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
    id: string
    agentId: string
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
    filePaths: JSON.parse(row.filePathsJson) as string[],
  }))
}

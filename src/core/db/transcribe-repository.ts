import { randomUUID } from 'node:crypto';
import { nowIso } from '../../shared/lib/time';
import { openDb } from './shared';

export type TranscribeJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type CreateTranscribeJobInput = {
  folderPath: string;
  filePaths: string[];
};

function getDb() {
  const db = openDb('transcribe.db');
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcribe_jobs (
      id TEXT PRIMARY KEY,
      folder_path TEXT NOT NULL,
      file_paths_json TEXT NOT NULL,
      source_file TEXT,
      save_path TEXT,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transcribe_jobs_created_at ON transcribe_jobs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transcribe_jobs_status ON transcribe_jobs(status);
  `);
  return db;
}

export function createTranscribeJob(input: CreateTranscribeJobInput) {
  const db = getDb();
  const id = randomUUID();
  const now = nowIso();

  db.prepare(`
    INSERT INTO transcribe_jobs (
      id,
      folder_path,
      file_paths_json,
      status,
      progress,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, 'queued', 0, ?, ?)
  `).run(id, input.folderPath, JSON.stringify(input.filePaths), now, now);

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
  `).run(status, Math.max(0, Math.min(100, Math.round(progress))), nowIso(), id);
}

export function completeTranscribeJob(id: string, sourceFile: string, savePath: string) {
  const db = getDb();
  db.prepare(`
    UPDATE transcribe_jobs
    SET status = 'completed',
        progress = 100,
        source_file = ?,
        save_path = ?,
        error_message = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(sourceFile, savePath, nowIso(), id);
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

export function listRecentTranscribeJobs(limit = 20) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      id,
      folder_path as folderPath,
      file_paths_json as filePathsJson,
      source_file as sourceFile,
      save_path as savePath,
      status,
      progress,
      error_message as errorMessage,
      created_at as createdAt,
      updated_at as updatedAt
    FROM transcribe_jobs
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: string;
    folderPath: string;
    filePathsJson: string;
    sourceFile: string | null;
    savePath: string | null;
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

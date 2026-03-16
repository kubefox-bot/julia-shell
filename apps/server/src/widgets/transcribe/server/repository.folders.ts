import { nextRecentFolderTimestamp } from '../../../core/db/transcribe-helpers'
import { getTranscribeDb } from './repository.shared'

const RECENT_FOLDERS_LIMIT = Number('5')

export function touchRecentFolder(agentId: string, widgetId: string, folderPath: string) {
  const db = getTranscribeDb()
  const normalizedPath = folderPath.trim()
  if (!normalizedPath) {
    return
  }

  const transaction = db.transaction(() => {
    const timestamp = nextRecentFolderTimestamp()

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
    `).run(agentId, widgetId, normalizedPath, timestamp)

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
          LIMIT ?
        )
    `).run(agentId, widgetId, agentId, widgetId, RECENT_FOLDERS_LIMIT)
  })

  transaction()
}

export function listRecentFolders(agentId: string, widgetId: string, limit = RECENT_FOLDERS_LIMIT) {
  const db = getTranscribeDb()
  return db.prepare(`
    SELECT folder_path as folderPath
    FROM transcribe_recent_folders
    WHERE agent_id = ? AND widget_id = ?
    ORDER BY last_used_at DESC
    LIMIT ?
  `).all(agentId, widgetId, limit) as Array<{ folderPath: string }>
}

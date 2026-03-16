import { nowIso } from '@shared/lib/time'
import { normalizeSpeakerKey } from '../../../core/db/transcribe-helpers'
import { getTranscribeDb, type TranscribeSpeakerAlias } from './repository.shared'

export function listSpeakerAliases(agentId: string, widgetId: string): TranscribeSpeakerAlias[] {
  const db = getTranscribeDb()
  return db.prepare(`
    SELECT
      speaker_key as speakerKey,
      alias_name as aliasName
    FROM transcribe_speaker_aliases
    WHERE agent_id = ? AND widget_id = ?
    ORDER BY speaker_key ASC
  `).all(agentId, widgetId) as TranscribeSpeakerAlias[]
}

export function saveSpeakerAliases(agentId: string, widgetId: string, aliases: TranscribeSpeakerAlias[]) {
  const db = getTranscribeDb()
  const transaction = db.transaction(() => {
    for (const entry of aliases) {
      const speakerKey = normalizeSpeakerKey(entry.speakerKey)
      if (!speakerKey) {
        continue
      }

      const aliasName = entry.aliasName.trim()
      if (!aliasName) {
        db.prepare(`
          DELETE FROM transcribe_speaker_aliases
          WHERE agent_id = ?
            AND widget_id = ?
            AND speaker_key = ?
        `).run(agentId, widgetId, speakerKey)
        continue
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
      `).run(agentId, widgetId, speakerKey, aliasName, nowIso())
    }
  })

  transaction()
  return listSpeakerAliases(agentId, widgetId)
}

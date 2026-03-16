import { nowIso } from '@shared/lib/time'
import { getTranscribeDb, type TranscribeWidgetSettings } from './repository.shared'

export function getTranscribeWidgetSettings(agentId: string, widgetId: string): TranscribeWidgetSettings {
  const db = getTranscribeDb()
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
    agentId: string
    widgetId: string
    geminiModel: string | null
    localApiKey: string | null
    updatedAt: string
  } | undefined

  return {
    agentId,
    widgetId,
    geminiModel: row?.geminiModel?.trim() ?? '',
    localApiKey: row?.localApiKey?.trim() ?? '',
    updatedAt: row?.updatedAt ?? null,
  }
}

export function saveTranscribeWidgetSettings(input: {
  agentId: string
  widgetId: string
  geminiModel: string
  localApiKey?: string
}) {
  const db = getTranscribeDb()
  const now = nowIso()
  const current = getTranscribeWidgetSettings(input.agentId, input.widgetId)

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
    now,
  )

  return getTranscribeWidgetSettings(input.agentId, input.widgetId)
}

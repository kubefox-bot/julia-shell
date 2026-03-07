import fs from 'node:fs/promises'
import path from 'node:path'
import { appendTranscribeOutboxEvent, listRecentFolders, listRecentTranscribeJobs, touchRecentFolder } from '../../../core/db/transcribe-repository'
import type { WidgetServerModule } from '../../../entities/widget/model/types'
import { jsonResponse, readJsonBody } from '../../../shared/lib/http'
import { WIDGET_ID } from './constants'
import { buildSettingsPayload, updateTranscribeSettings } from './settings'
import { handleTranscribeStream } from './transcribe-stream'
import { listPathEntries, resolveTranscriptPath } from './utils'

export const transcribeHandlers: WidgetServerModule['handlers'] = {
  'POST fs-list': async ({ request }) => {
    try {
      const body = await readJsonBody<{ path?: string }>(request)
      const payload = await listPathEntries(body.path ?? '')
      touchRecentFolder(WIDGET_ID, payload.path)
      return jsonResponse({
        ...payload,
        recentFolders: listRecentFolders(WIDGET_ID).map((entry) => entry.folderPath)
      })
    } catch (error) {
      return jsonResponse({
        error: error instanceof Error ? error.message : 'Failed to list path.'
      }, 500)
    }
  },
  'GET settings': async () => {
    return jsonResponse(await buildSettingsPayload())
  },
  'POST settings': async ({ request }) => {
    const body = await readJsonBody<{ geminiModel?: string; apiKey?: string }>(request)
    return jsonResponse(await updateTranscribeSettings(body))
  },
  'POST transcript-read': async ({ request }) => {
    const body = await readJsonBody<{ sourceFile?: string; txtPath?: string; folderPath?: string }>(request)

    try {
      const txtPath = await resolveTranscriptPath(body)
      const stat = await fs.stat(txtPath)
      if (!stat.isFile()) {
        throw new Error('Transcript txt path is not a file.')
      }

      const transcript = await fs.readFile(txtPath, 'utf8')
      appendTranscribeOutboxEvent({
        widgetId: WIDGET_ID,
        eventType: 'transcript_opened',
        state: 'ready',
        payload: {
          txtPath,
          sourceFile: body.sourceFile ?? null
        }
      })

      return jsonResponse({
        sourceFile: body.sourceFile || null,
        txtPath,
        transcript
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transcript read failed.'
      return jsonResponse({
        error: message.includes('Не найден')
          ? message
          : `Не найден файл стенограммы: ${path.basename(typeof body.txtPath === 'string' ? body.txtPath : body.sourceFile ?? 'transcript.txt')}`
      }, 404)
    }
  },
  'GET jobs': async () => {
    return jsonResponse({ jobs: listRecentTranscribeJobs(30) })
  },
  'POST transcribe-stream': async ({ request }) => {
    const body = await readJsonBody<{
      folderPath?: string
      filePath?: string
      filePaths?: string[]
    }>(request)

    return handleTranscribeStream(body, request)
  }
}

import fs from 'node:fs/promises'
import path from 'node:path'
import { passportRuntime } from '@passport/server/runtime'
import { appendTranscribeOutboxEvent, listRecentFolders, listRecentTranscribeJobs, listSpeakerAliases, saveSpeakerAliases, touchRecentFolder } from '@core/db/transcribe-repository'
import type { WidgetServerModule } from '../../../entities/widget/model/types'
import { jsonResponse, readJsonBody } from '../../../shared/lib/http'
import { isAgentRequiredForTranscribe } from './agent-mode'
import { WIDGET_ID } from './constants'
import { buildSettingsPayload, updateTranscribeSettings } from './settings'
import { handleTranscribeStream } from './transcribe-stream'
import { listPathEntries, resolveTranscriptPath } from './utils'

const STATUS_BAD_REQUEST = 400
const STATUS_NOT_FOUND = 404
const STATUS_INTERNAL_SERVER_ERROR = 500
const STATUS_SERVICE_UNAVAILABLE = 503
const RECENT_JOBS_LIMIT = 30

export const transcribeHandlers: WidgetServerModule['handlers'] = {
  'POST fs-list': async ({ request, agentId }) => {
    if (isAgentRequiredForTranscribe() && !passportRuntime.getOnlineAgentSession()) {
      return jsonResponse({
        error: 'agent_offline'
      }, STATUS_SERVICE_UNAVAILABLE)
    }

    try {
      const body = await readJsonBody<{ path?: string }>(request)
      const payload = await listPathEntries(body.path ?? '')
      touchRecentFolder(agentId, WIDGET_ID, payload.path)
      return jsonResponse({
        ...payload,
        recentFolders: listRecentFolders(agentId, WIDGET_ID).map((entry) => entry.folderPath)
      })
    } catch (error) {
      return jsonResponse({
        error: error instanceof Error ? error.message : 'Failed to list path.'
      }, STATUS_INTERNAL_SERVER_ERROR)
    }
  },
  'GET settings': async ({ agentId }) => {
    return jsonResponse(await buildSettingsPayload(agentId))
  },
  'POST settings': async ({ request, agentId }) => {
    const body = await readJsonBody<{ geminiModel?: string; apiKey?: string }>(request)
    return jsonResponse(await updateTranscribeSettings(agentId, body))
  },
  'GET speaker-aliases': async ({ agentId }) => {
    return jsonResponse({
      aliases: listSpeakerAliases(agentId, WIDGET_ID)
    })
  },
  'POST speaker-aliases': async ({ request, agentId }) => {
    const body = await readJsonBody<{
      aliases?: Array<{ speakerKey?: string; aliasName?: string }>
    }>(request)

    const aliases = Array.isArray(body.aliases)
      ? body.aliases.map((entry) => ({
          speakerKey: String(entry.speakerKey ?? ''),
          aliasName: String(entry.aliasName ?? '')
        }))
      : []

    return jsonResponse({
      aliases: saveSpeakerAliases(agentId, WIDGET_ID, aliases)
    })
  },
  'POST transcript-read': async ({ request, agentId }) => {
    const body = await readJsonBody<{ sourceFile?: string; txtPath?: string; folderPath?: string }>(request)

    try {
      const txtPath = await resolveTranscriptPath(body)
      const stat = await fs.stat(txtPath)
      if (!stat.isFile()) {
        throw new Error('Transcript txt path is not a file.')
      }

      const transcript = await fs.readFile(txtPath, 'utf8')
      appendTranscribeOutboxEvent({
        agentId,
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
      }, STATUS_NOT_FOUND)
    }
  },
  'POST transcript-save': async ({ request, agentId }) => {
    const body = await readJsonBody<{
      sourceFile?: string
      txtPath?: string
      folderPath?: string
      transcript?: string
    }>(request)

    try {
      if (typeof body.transcript !== 'string') {
        throw new Error('transcript is required.')
      }

      const txtPath = await resolveTranscriptPath(body)
      await fs.writeFile(txtPath, body.transcript, 'utf8')
      appendTranscribeOutboxEvent({
        agentId,
        widgetId: WIDGET_ID,
        eventType: 'file_created',
        state: 'updated',
        payload: {
          savePath: txtPath,
          sourceFile: body.sourceFile ?? null
        }
      })

      return jsonResponse({
        txtPath
      })
    } catch (error) {
      return jsonResponse({
        error: error instanceof Error ? error.message : 'Transcript save failed.'
      }, STATUS_BAD_REQUEST)
    }
  },
  'GET jobs': async ({ agentId }) => {
    return jsonResponse({ jobs: listRecentTranscribeJobs(agentId, RECENT_JOBS_LIMIT) })
  },
  'POST transcribe-stream': async ({ request, agentId }) => {
    const body = await readJsonBody<{
      folderPath?: string
      filePath?: string
      filePaths?: string[]
    }>(request)

    return handleTranscribeStream(body, request, agentId)
  }
}

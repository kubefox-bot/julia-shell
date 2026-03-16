import fs from 'node:fs/promises'
import path from 'node:path'
import { passportRuntime } from '@passport/server/runtime'
import { appendTranscribeOutboxEvent, listRecentFolders, listRecentTranscribeJobs, listSpeakerAliases, saveSpeakerAliases, touchRecentFolder } from './repository'
import type { WidgetServerModule } from '../../../entities/widget/model/types'
import { jsonResponse, readJsonBody } from '@shared/lib/http'
import { fromThrowablePromise } from '@shared/lib/result'
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
} from '@shared/lib/http-status'
import { WIDGET_ID } from './constants'
import { buildSettingsPayload, updateTranscribeSettings } from './settings'
import { handleTranscribeStream } from './transcribe-stream'
import { listPathEntries, resolveTranscriptPath } from './utils'

const RECENT_TRANSCRIBE_JOBS_LIMIT = Number('30')

export const transcribeHandlers: WidgetServerModule['handlers'] = {
  'POST fs-list': async ({ request, agentId }) => {
    if (!passportRuntime.getOnlineAgentSession(agentId)) {
      return jsonResponse({
        error: 'agent_offline'
      }, HTTP_STATUS_SERVICE_UNAVAILABLE)
    }

    return fromThrowablePromise(
      readJsonBody<{ path?: string }>(request)
        .then((body) => listPathEntries(body.path ?? ''))
    ).match(
      (payload) => {
        touchRecentFolder(agentId, WIDGET_ID, payload.path)
        return jsonResponse({
          ...payload,
          recentFolders: listRecentFolders(agentId, WIDGET_ID).map((entry) => entry.folderPath)
        })
      },
      (error) => jsonResponse({
        error: error instanceof Error ? error.message : 'Failed to list path.'
      }, HTTP_STATUS_INTERNAL_SERVER_ERROR)
    )
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
      }, HTTP_STATUS_NOT_FOUND)
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
      }, HTTP_STATUS_BAD_REQUEST)
    }
  },
  'GET jobs': async ({ agentId }) => {
    return jsonResponse({ jobs: listRecentTranscribeJobs(agentId, RECENT_TRANSCRIBE_JOBS_LIMIT) })
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

import { passportRuntime } from '@passport/server/runtime'
import type { WidgetServerModule } from '../../../entities/widget/model/types'
import { jsonResponse, readJsonBody } from '@shared/lib/http'
import { z } from 'zod'
import { getTerminalAgentSettings } from '../../../domains/llm/server/repository/terminal-agent-repository'
import { getLlmModelCatalog } from '../../../domains/llm/server'
import { WIDGET_ID } from './constants'
import { toTerminalAgentLlmModelsHttpError, toTerminalAgentLlmModelsPayload } from './llm-models-mapping'
import { handleTerminalAgentMessageStream } from './message-stream'
import {
  buildTerminalAgentSettingsPayload,
  getTerminalAgentDialogStatePayload,
  listTerminalAgentDialogsPayload,
  resetTerminalAgentDialog,
  selectTerminalAgentDialog,
  updateTerminalAgentSettings,
} from './settings'
import { toArgs, toProvider } from './utils'

const modelsQuerySchema = z.object({
  provider: z.enum(['codex', 'gemini']).default('codex'),
  refresh: z.enum(['0', '1']).optional(),
})

export const terminalAgentHandlers: WidgetServerModule['handlers'] = {
  'GET settings': async ({ agentId }) => {
    return jsonResponse(buildTerminalAgentSettingsPayload(agentId))
  },
  'POST settings': async ({ request, agentId }) => {
    const body = await readJsonBody<Record<string, unknown>>(request)
    const payload = updateTerminalAgentSettings(agentId, {
      activeProvider: toProvider(body.activeProvider),
      codexApiKey: typeof body.codexApiKey === 'string' ? body.codexApiKey : undefined,
      geminiApiKey: typeof body.geminiApiKey === 'string' ? body.geminiApiKey : undefined,
      codexCommand: typeof body.codexCommand === 'string' ? body.codexCommand : undefined,
      codexArgs: Array.isArray(body.codexArgs) ? toArgs(body.codexArgs) : undefined,
      codexModel: typeof body.codexModel === 'string' ? body.codexModel : undefined,
      geminiCommand: typeof body.geminiCommand === 'string' ? body.geminiCommand : undefined,
      geminiArgs: Array.isArray(body.geminiArgs) ? toArgs(body.geminiArgs) : undefined,
      geminiModel: typeof body.geminiModel === 'string' ? body.geminiModel : undefined,
      useShellFallback: typeof body.useShellFallback === 'boolean' ? body.useShellFallback : undefined,
      shellOverride: typeof body.shellOverride === 'string' ? body.shellOverride : undefined,
    })

    return jsonResponse(payload)
  },
  'GET dialog-state': async ({ request, agentId }) => {
    const url = new URL(request.url)
    const provider = toProvider(url.searchParams.get('provider'))
    return jsonResponse(getTerminalAgentDialogStatePayload(agentId, provider))
  },
  'POST dialog/new': async ({ request, agentId }) => {
    const body = await readJsonBody<Record<string, unknown>>(request)
    const provider = toProvider(body.provider)
    const payload = resetTerminalAgentDialog(agentId, provider)

    const onlineAgent = passportRuntime.getOnlineAgentSession(agentId)
    if (onlineAgent) {
      passportRuntime.dispatchTerminalAgentResetDialog({
        agentId: onlineAgent.agentId,
        sessionId: onlineAgent.sessionId,
        dialogId: `${WIDGET_ID}:${provider}`,
        reason: 'new_dialog',
      })
    }

    return jsonResponse(payload)
  },
  'GET dialogs': async ({ request, agentId }) => {
    const url = new URL(request.url)
    const provider = toProvider(url.searchParams.get('provider'))
    return jsonResponse({
      widgetId: WIDGET_ID,
      provider,
      items: listTerminalAgentDialogsPayload(agentId, provider),
    })
  },
  'GET models': async ({ request, agentId }) => {
    const url = new URL(request.url)
    const parsedQuery = modelsQuerySchema.safeParse({
      provider: url.searchParams.get('provider') ?? 'codex',
      refresh: url.searchParams.get('refresh') ?? undefined,
    })
    if (!parsedQuery.success) {
      return jsonResponse({ error: 'Invalid query params.' }, 400)
    }

    const provider = parsedQuery.data.provider
    const forceRefresh = parsedQuery.data.refresh === '1'
    const settings = getTerminalAgentSettings(agentId, WIDGET_ID)
    const apiKey = provider === 'codex' ? settings.codexApiKey : settings.geminiApiKey
    const catalogResult = await getLlmModelCatalog({
      provider,
      apiKey,
      forceRefresh,
    })
    if (catalogResult.isErr()) {
      const mappedError = toTerminalAgentLlmModelsHttpError(catalogResult.error)
      return jsonResponse(mappedError.payload, mappedError.status)
    }
    return jsonResponse(toTerminalAgentLlmModelsPayload(catalogResult.value))
  },
  'POST dialog/select': async ({ request, agentId }) => {
    const body = await readJsonBody<Record<string, unknown>>(request)
    const provider = toProvider(body.provider)
    const providerSessionRef = typeof body.providerSessionRef === 'string'
      ? body.providerSessionRef.trim()
      : ''

    if (!providerSessionRef) {
      return jsonResponse({ error: 'providerSessionRef is required.' }, 400)
    }

    const payload = selectTerminalAgentDialog(agentId, provider, providerSessionRef)
    return jsonResponse(payload)
  },
  'POST message-stream': async ({ request, agentId }) => {
    const body = await readJsonBody<Record<string, unknown>>(request)
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const provider = toProvider(body.provider)

    if (!message) {
      return jsonResponse({ error: 'message is required.' }, 400)
    }

    return handleTerminalAgentMessageStream({
      request,
      agentId,
      provider,
      message,
    })
  },
}

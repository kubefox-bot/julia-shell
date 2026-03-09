import { passportRuntime } from '@passport/server/runtime'
import type { WidgetServerModule } from '../../../entities/widget/model/types'
import { jsonResponse, readJsonBody } from '../../../shared/lib/http'
import { WIDGET_ID } from './constants'
import { handleTerminalAgentMessageStream } from './message-stream'
import {
  buildTerminalAgentSettingsPayload,
  getTerminalAgentDialogStatePayload,
  resetTerminalAgentDialog,
  updateTerminalAgentSettings,
} from './settings'
import { toArgs, toProvider } from './utils'

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
      geminiCommand: typeof body.geminiCommand === 'string' ? body.geminiCommand : undefined,
      geminiArgs: Array.isArray(body.geminiArgs) ? toArgs(body.geminiArgs) : undefined,
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

    const onlineAgent = passportRuntime.getOnlineAgentSession()
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

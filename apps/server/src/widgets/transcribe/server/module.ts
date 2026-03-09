import type { WidgetServerModule } from '../../../entities/widget/model/types'
import { passportRuntime } from '../../../domains/passport/server/runtime'
import { transcribeHandlers } from './handlers'
import { isAgentRequiredForTranscribe } from './agent-mode'
import { WIDGET_ID } from './constants'
import { buildAvailableModels, getHostPlatform, isSupportedAudioPath, resolveConfiguredModel, resolveTranscriptPath, toTranscriptPath } from './utils'

export const transcribeServerModule: WidgetServerModule = {
  init: async () => {
    if (!isAgentRequiredForTranscribe()) {
      return { ready: true };
    }

    const onlineAgent = passportRuntime.getOnlineAgentSession();
    if (!onlineAgent) {
      return {
        ready: false,
        reason: `${WIDGET_ID} widget requires agent.`
      };
    }

    return { ready: true };
  },
  handlers: transcribeHandlers
}

export const transcribeServerInternals = {
  buildAvailableModels,
  getHostPlatform,
  isSupportedAudioPath,
  resolveConfiguredModel,
  resolveTranscriptPath,
  toTranscriptPath
}

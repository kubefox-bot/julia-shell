import type { WidgetServerModule } from '../../../entities/widget/model/types'
import { agentRuntime } from '../../../core/agent/runtime'
import { transcribeHandlers } from './handlers'
import { isAgentRequiredForTranscribe } from './agent-mode'
import { buildAvailableModels, getHostPlatform, isSupportedAudioPath, resolveConfiguredModel, resolveTranscriptPath, toTranscriptPath } from './utils'

export const transcribeServerModule: WidgetServerModule = {
  init: async () => {
    if (!isAgentRequiredForTranscribe()) {
      return { ready: true };
    }

    const onlineAgent = agentRuntime.getOnlineAgentSession();
    if (!onlineAgent) {
      return {
        ready: false,
        reason: 'Agent is required for transcribe in production mode.'
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

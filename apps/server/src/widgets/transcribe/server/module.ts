import type { WidgetServerModule } from '../../../entities/widget/model/types'
import { transcribeHandlers } from './handlers'
import { buildAvailableModels, getHostPlatform, isSupportedAudioPath, resolveConfiguredModel, resolveTranscriptPath, toTranscriptPath } from './utils'

export const transcribeServerModule: WidgetServerModule = {
  init: async () => ({ ready: true }),
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

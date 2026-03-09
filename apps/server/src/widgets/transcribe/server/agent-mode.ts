import { readRuntimeEnv } from '../../../core/env'

export function isTranscribeDevBypassMode() {
  return readRuntimeEnv().passportAgentDevModeEnabled
}

export function isAgentRequiredForTranscribe() {
  return !isTranscribeDevBypassMode()
}

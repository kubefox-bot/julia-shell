import { ENV_DEFAULTS, ENV_KEYS, ENV_LIMITS } from './consts'
import type { AppRuntimeEnv } from './types'
import { clampInteger, parseEnvFlag, parseEnvInteger, parseEnvString } from './utils'

function resolveShellStatusPollIntervalMs() {
  const parsedValue = parseEnvInteger(process.env[ENV_KEYS.shellStatusPollIntervalMs])
  if (parsedValue === null) {
    return ENV_DEFAULTS.shellStatusPollIntervalMs
  }

  return clampInteger(
    parsedValue,
    ENV_LIMITS.shellStatusPollIntervalMs.min,
    ENV_LIMITS.shellStatusPollIntervalMs.max
  )
}

function resolvePassportHeartbeatTimeoutMs() {
  const parsedValue = parseEnvInteger(process.env[ENV_KEYS.passportHeartbeatTimeoutMs])
  if (parsedValue === null) {
    return ENV_DEFAULTS.passportHeartbeatTimeoutMs
  }

  return clampInteger(
    parsedValue,
    ENV_LIMITS.passportHeartbeatTimeoutMs.min,
    ENV_LIMITS.passportHeartbeatTimeoutMs.max
  )
}

function resolvePassportGrpcPort() {
  const parsedValue = parseEnvInteger(process.env[ENV_KEYS.passportGrpcPort])
  if (parsedValue === null) {
    return ENV_DEFAULTS.passportGrpcPort
  }

  return clampInteger(parsedValue, ENV_LIMITS.passportGrpcPort.min, ENV_LIMITS.passportGrpcPort.max)
}

export function readRuntimeEnv(): AppRuntimeEnv {
  return {
    shellStatusPollIntervalMs: resolveShellStatusPollIntervalMs(),
    passportHeartbeatTimeoutMs: resolvePassportHeartbeatTimeoutMs(),
    passportGrpcPort: resolvePassportGrpcPort(),
    passportAgentDevModeEnabled: parseEnvFlag(process.env[ENV_KEYS.passportAgentDevModeEnabled]),
    passportProtocolProtoPath: parseEnvString(process.env[ENV_KEYS.passportProtocolProtoPath]),
    transcribeAgentMockModeEnabled: parseEnvFlag(
      process.env[ENV_KEYS.transcribeAgentMockModeEnabled]
    ),
    geminiModel: parseEnvString(process.env[ENV_KEYS.geminiModel]),
    isDevelopment: import.meta.env.DEV,
  }
}

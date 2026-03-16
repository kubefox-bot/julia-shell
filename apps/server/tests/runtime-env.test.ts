import { afterEach, describe, expect, it } from 'vitest'
import { readRuntimeEnv } from '../src/core/env'
import {
  PASSPORT_GRPC_PORT_DEFAULT,
  PASSPORT_GRPC_PORT_ENV_KEY,
  PASSPORT_GRPC_PORT_MAX,
  PASSPORT_GRPC_PORT_MIN,
  PASSPORT_HEARTBEAT_TIMEOUT_DEFAULT_MS,
  PASSPORT_HEARTBEAT_TIMEOUT_ENV_KEY,
  PASSPORT_HEARTBEAT_TIMEOUT_MAX_MS,
  PASSPORT_HEARTBEAT_TIMEOUT_MIN_MS,
} from '../src/shared/config/passport-runtime'
import {
  SHELL_STATUS_POLL_INTERVAL_DEFAULT_MS,
  SHELL_STATUS_POLL_INTERVAL_ENV_KEY,
  SHELL_STATUS_POLL_INTERVAL_MAX_MS,
  SHELL_STATUS_POLL_INTERVAL_MIN_MS,
} from '../src/shared/config/shell-status-polling'

const ENV_KEYS = [
  SHELL_STATUS_POLL_INTERVAL_ENV_KEY,
  PASSPORT_HEARTBEAT_TIMEOUT_ENV_KEY,
  PASSPORT_GRPC_PORT_ENV_KEY,
  'JULIAAPP_PROTOCOL_PROTO_PATH',
  'GEMINI_MODEL',
] as const

const ORIGINAL_ENV_VALUES = new Map(ENV_KEYS.map((key) => [key, process.env[key]]))

afterEach(() => {
  for (const key of ENV_KEYS) {
    const originalValue = ORIGINAL_ENV_VALUES.get(key)
    if (originalValue === undefined) {
      delete process.env[key]
      continue
    }

    process.env[key] = originalValue
  }
})

describe('runtime env', () => {
  it('uses default values for integer envs when missing or invalid', () => {
    delete process.env[SHELL_STATUS_POLL_INTERVAL_ENV_KEY]
    delete process.env[PASSPORT_HEARTBEAT_TIMEOUT_ENV_KEY]
    delete process.env[PASSPORT_GRPC_PORT_ENV_KEY]

    const defaults = readRuntimeEnv()
    expect(defaults.shellStatusPollIntervalMs).toBe(SHELL_STATUS_POLL_INTERVAL_DEFAULT_MS)
    expect(defaults.passportHeartbeatTimeoutMs).toBe(PASSPORT_HEARTBEAT_TIMEOUT_DEFAULT_MS)
    expect(defaults.passportGrpcPort).toBe(PASSPORT_GRPC_PORT_DEFAULT)

    process.env[SHELL_STATUS_POLL_INTERVAL_ENV_KEY] = 'nan'
    process.env[PASSPORT_HEARTBEAT_TIMEOUT_ENV_KEY] = 'nan'
    process.env[PASSPORT_GRPC_PORT_ENV_KEY] = 'nan'

    const invalidValues = readRuntimeEnv()
    expect(invalidValues.shellStatusPollIntervalMs).toBe(SHELL_STATUS_POLL_INTERVAL_DEFAULT_MS)
    expect(invalidValues.passportHeartbeatTimeoutMs).toBe(PASSPORT_HEARTBEAT_TIMEOUT_DEFAULT_MS)
    expect(invalidValues.passportGrpcPort).toBe(PASSPORT_GRPC_PORT_DEFAULT)
  })

  it('clamps integer env values within allowed range', () => {
    process.env[SHELL_STATUS_POLL_INTERVAL_ENV_KEY] = '100'
    process.env[PASSPORT_HEARTBEAT_TIMEOUT_ENV_KEY] = '1000'
    process.env[PASSPORT_GRPC_PORT_ENV_KEY] = '0'

    const lowerBoundValues = readRuntimeEnv()
    expect(lowerBoundValues.shellStatusPollIntervalMs).toBe(SHELL_STATUS_POLL_INTERVAL_MIN_MS)
    expect(lowerBoundValues.passportHeartbeatTimeoutMs).toBe(PASSPORT_HEARTBEAT_TIMEOUT_MIN_MS)
    expect(lowerBoundValues.passportGrpcPort).toBe(PASSPORT_GRPC_PORT_MIN)

    process.env[SHELL_STATUS_POLL_INTERVAL_ENV_KEY] = '120000'
    process.env[PASSPORT_HEARTBEAT_TIMEOUT_ENV_KEY] = '99999999'
    process.env[PASSPORT_GRPC_PORT_ENV_KEY] = '70000'

    const upperBoundValues = readRuntimeEnv()
    expect(upperBoundValues.shellStatusPollIntervalMs).toBe(SHELL_STATUS_POLL_INTERVAL_MAX_MS)
    expect(upperBoundValues.passportHeartbeatTimeoutMs).toBe(PASSPORT_HEARTBEAT_TIMEOUT_MAX_MS)
    expect(upperBoundValues.passportGrpcPort).toBe(PASSPORT_GRPC_PORT_MAX)
  })

  it('resolves boolean and string runtime flags', () => {
    process.env.JULIAAPP_PROTOCOL_PROTO_PATH = ' /tmp/proto/agent_control.proto '
    process.env.GEMINI_MODEL = ' gemini-2.5-flash '

    const runtimeEnv = readRuntimeEnv()
    expect(runtimeEnv.passportProtocolProtoPath).toBe('/tmp/proto/agent_control.proto')
    expect(runtimeEnv.geminiModel).toBe('gemini-2.5-flash')
    expect(typeof runtimeEnv.isDevelopment).toBe('boolean')
  })
})

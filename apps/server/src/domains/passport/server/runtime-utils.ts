import fs from 'node:fs'
import path from 'node:path'
import { readRuntimeEnv } from '../../../core/env'

export function isAgentDevMode() {
  return readRuntimeEnv().passportAgentDevModeEnabled
}

export function resolveProtoPath() {
  const fromEnv = readRuntimeEnv().passportProtocolProtoPath
  const candidates = [
    fromEnv,
    path.join(process.cwd(), 'packages', 'protocol', 'proto', 'agent_control.proto'),
    path.join(process.cwd(), '..', '..', 'packages', 'protocol', 'proto', 'agent_control.proto'),
    path.join(process.cwd(), 'proto', 'agent_control.proto'),
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error('agent_control.proto is not found. Set JULIAAPP_PROTOCOL_PROTO_PATH.')
}

export function extractHeartbeatHostname(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return ''
  }

  const hostname = (value as { hostname?: unknown }).hostname
  return typeof hostname === 'string' ? hostname.trim() : ''
}

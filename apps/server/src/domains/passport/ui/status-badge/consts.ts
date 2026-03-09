import type { PassportAuthStatus } from '../../client/types'
import type { AgentPlatform } from './types'

export const PASSPORT_STATUS_COPY_KEY_BY_STATUS = {
  connected: 'agentStatusConnected',
  connected_dev: 'agentStatusConnectedDev',
  unauthorized: 'agentStatusUnauthorized',
  disconnected: 'agentStatusDisconnected',
} as const satisfies Record<PassportAuthStatus, string>

export const AGENT_ASSET_BY_PLATFORM: Record<AgentPlatform, string> = {
  windows: 'julia-agent-windows-x64.zip',
  macos: 'julia-agent-macos-arm64.tar.gz',
  linux: 'julia-agent-linux-x64.tar.gz',
}

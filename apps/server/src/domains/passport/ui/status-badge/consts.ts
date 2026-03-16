import type { AgentPlatform, PassportTrafficLightState } from './types'

export const PASSPORT_STATUS_COPY_KEY_BY_TRAFFIC_LIGHT = {
  red: 'agentStatusNoAgents',
  yellow: 'agentStatusNeedsSelection',
  green: 'agentStatusConnected',
} as const satisfies Record<PassportTrafficLightState, string>

export const AGENT_ASSET_BY_PLATFORM: Record<AgentPlatform, string> = {
  windows: 'julia-agent-windows-x64.zip',
  macos: 'julia-agent-macos-arm64.tar.gz',
  linux: 'julia-agent-linux-x64.tar.gz',
}

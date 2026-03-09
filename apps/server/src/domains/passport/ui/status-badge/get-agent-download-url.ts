import { AGENT_ASSET_BY_PLATFORM } from './consts'
import type { AgentPlatform } from './types'

export function getAgentDownloadUrl(baseUrl: string, platform: AgentPlatform) {
  return `${baseUrl}/${AGENT_ASSET_BY_PLATFORM[platform]}`
}

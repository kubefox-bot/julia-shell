import type { PassportAuthStatus } from '../../client/types'
import type { PassportTrafficLightState } from './types'

const TRAFFIC_LIGHT_RESOLVER_BY_STATUS: Record<
  PassportAuthStatus,
  (onlineAgentsCount: number) => PassportTrafficLightState
> = {
  connected: () => 'green',
  connected_dev: () => 'green',
  unauthorized: () => 'yellow',
  disconnected: (onlineAgentsCount) => (onlineAgentsCount > 0 ? 'yellow' : 'red'),
}

export function resolvePassportTrafficLightState(input: {
  status: PassportAuthStatus
  onlineAgentsCount: number
}): PassportTrafficLightState {
  return TRAFFIC_LIGHT_RESOLVER_BY_STATUS[input.status](input.onlineAgentsCount)
}

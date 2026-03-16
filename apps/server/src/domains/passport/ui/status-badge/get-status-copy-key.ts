import type { PassportAuthStatus } from '../../client/types'
import { PASSPORT_STATUS_COPY_KEY_BY_TRAFFIC_LIGHT } from './consts'
import type { PassportTrafficLightState } from './types'

const GREEN_STATUS_COPY_KEY_BY_STATUS: Partial<Record<PassportAuthStatus, string>> = {
  connected: 'agentStatusConnected',
  connected_dev: 'agentStatusConnectedDev',
}

const STATUS_COPY_KEY_RESOLVER_BY_TRAFFIC_LIGHT: Record<
  PassportTrafficLightState,
  (status: PassportAuthStatus) => string
> = {
  green: (status) => GREEN_STATUS_COPY_KEY_BY_STATUS[status] ?? 'agentStatusConnected',
  yellow: () => PASSPORT_STATUS_COPY_KEY_BY_TRAFFIC_LIGHT.yellow,
  red: () => PASSPORT_STATUS_COPY_KEY_BY_TRAFFIC_LIGHT.red,
}

export function getStatusCopyKey(input: {
  status: PassportAuthStatus
  trafficLightState: PassportTrafficLightState
}) {
  return STATUS_COPY_KEY_RESOLVER_BY_TRAFFIC_LIGHT[input.trafficLightState](input.status)
}

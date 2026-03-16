import type { PassportAuthStatus } from '../../client/types'
import { PASSPORT_STATUS_COPY_KEY_BY_TRAFFIC_LIGHT } from './consts'
import type { PassportTrafficLightState } from './types'

export type PassportStatusCopyKey =
  | 'agentStatusConnected'
  | 'agentStatusUnauthorized'
  | 'agentStatusNeedsSelection'
  | 'agentStatusNoAgents'

const GREEN_STATUS_COPY_KEY_BY_STATUS: Partial<Record<PassportAuthStatus, PassportStatusCopyKey>> = {
  connected: 'agentStatusConnected',
}

const STATUS_COPY_KEY_RESOLVER_BY_TRAFFIC_LIGHT: Record<
  PassportTrafficLightState,
  (status: PassportAuthStatus) => PassportStatusCopyKey
> = {
  green: (status) => GREEN_STATUS_COPY_KEY_BY_STATUS[status] ?? 'agentStatusConnected',
  yellow: (status) => (status === 'unauthorized'
    ? 'agentStatusUnauthorized'
    : PASSPORT_STATUS_COPY_KEY_BY_TRAFFIC_LIGHT.yellow),
  red: () => PASSPORT_STATUS_COPY_KEY_BY_TRAFFIC_LIGHT.red,
}

export function getStatusCopyKey(input: {
  status: PassportAuthStatus
  trafficLightState: PassportTrafficLightState
}) {
  return STATUS_COPY_KEY_RESOLVER_BY_TRAFFIC_LIGHT[input.trafficLightState](input.status)
}

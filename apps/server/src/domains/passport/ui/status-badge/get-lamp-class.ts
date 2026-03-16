import type { PassportLampClassKey, PassportTrafficLightState } from './types'

const LAMP_CLASS_KEY_BY_STATE = {
  green: 'agentLampGreen',
  yellow: 'agentLampYellow',
  red: 'agentLampRed',
} as const satisfies Record<PassportTrafficLightState, PassportLampClassKey>

export function getLampClassKey(state: PassportTrafficLightState) {
  return LAMP_CLASS_KEY_BY_STATE[state]
}

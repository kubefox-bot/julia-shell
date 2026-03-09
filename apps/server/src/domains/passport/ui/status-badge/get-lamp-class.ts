import type { PassportAuthStatus } from '../../client/types'
import styles from '../PassportStatusBadge.module.scss'

export function getLampClass(status: PassportAuthStatus) {
  if (status === 'connected' || status === 'connected_dev') {
    return styles.agentLampGreen
  }

  if (status === 'unauthorized') {
    return styles.agentLampYellow
  }

  return styles.agentLampRed
}

import type { PassportAuthStatus } from '../../client/types'
import { PASSPORT_STATUS_COPY_KEY_BY_STATUS } from './consts'

export function getStatusCopyKey(status: PassportAuthStatus) {
  return PASSPORT_STATUS_COPY_KEY_BY_STATUS[status]
}

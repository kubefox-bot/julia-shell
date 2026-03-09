import {
  PUBLIC_AGENT_RELEASES_BASE_URL_DEFAULT,
  PUBLIC_AGENT_RELEASES_BASE_URL_ENV_KEY,
} from '../../shared/config/passport-runtime'
import type { AppPublicEnv } from './types'
import { parseEnvString } from './utils'

function sanitizeBaseUrl(value: string | null) {
  if (!value) {
    return PUBLIC_AGENT_RELEASES_BASE_URL_DEFAULT
  }

  return value.replace(/\/+$/, '')
}

export function readPublicEnv(): AppPublicEnv {
  const publicEnv = import.meta.env as Record<string, string | undefined>

  return {
    agentReleasesBaseUrl: sanitizeBaseUrl(
      parseEnvString(publicEnv[PUBLIC_AGENT_RELEASES_BASE_URL_ENV_KEY])
    ),
  }
}

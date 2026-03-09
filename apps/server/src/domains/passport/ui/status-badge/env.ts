import { readPublicEnv } from '@core/env/public'

export function resolveAgentReleasesBaseUrl() {
  return readPublicEnv().agentReleasesBaseUrl
}

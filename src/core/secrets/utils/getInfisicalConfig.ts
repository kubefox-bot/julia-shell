import type { InfisicalConfig } from '../types'

export function getInfisicalConfig(): InfisicalConfig | null {
  const clientId = process.env.INFISICAL_CLIENT_ID?.trim()
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET?.trim()
  const projectId = process.env.INFISICAL_PROJECT_ID?.trim()
  const siteUrl = process.env.INFISICAL_SITE_URL?.trim()

  if (!clientId || !clientSecret || !projectId) {
    return null
  }

  return {
    clientId,
    clientSecret,
    projectId,
    siteUrl: siteUrl || undefined,
  }
}

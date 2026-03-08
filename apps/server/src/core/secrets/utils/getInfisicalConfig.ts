import type { InfisicalConfig } from '../types'

export function getInfisicalConfig(): InfisicalConfig | null {
  const accessToken = process.env.JULIAAPP_INFISICAL_ACCESS_TOKEN?.trim()
  const clientId = process.env.JULIAAPP_INFISICAL_CLIENT_ID?.trim()
  const clientSecret = process.env.JULIAAPP_INFISICAL_CLIENT_SECRET?.trim()
  const projectId = process.env.JULIAAPP_INFISICAL_PROJECT_ID?.trim()
  const siteUrl = process.env.JULIAAPP_INFISICAL_SITE_URL?.trim()
  const environment = process.env.JULIAAPP_INFISICAL_ENVIRONMENT?.trim() || 'main'

  const hasAccessToken = Boolean(accessToken)
  const hasUniversalAuth = Boolean(clientId && clientSecret)

  if (!projectId || (!hasAccessToken && !hasUniversalAuth)) {
    return null
  }

  return {
    projectId,
    siteUrl: siteUrl || undefined,
    environment,
    accessToken: accessToken || undefined,
    clientId: clientId || undefined,
    clientSecret: clientSecret || undefined,
  }
}

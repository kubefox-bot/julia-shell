import { InfisicalSDK } from '@infisical/sdk'
import { logger } from '../../shared/lib/logger'
import type { InfisicalConfig } from './types'

function createSdk(config: InfisicalConfig) {
  return new InfisicalSDK({ siteUrl: config.siteUrl })
}

function hasAccessToken(config: InfisicalConfig) {
  return Boolean(config.accessToken)
}

function hasUniversalAuth(config: InfisicalConfig) {
  return Boolean(config.clientId && config.clientSecret)
}

export async function authenticateInfisicalClient(config: InfisicalConfig): Promise<InfisicalSDK | null> {
  const sdk = createSdk(config)

  if (hasAccessToken(config)) {
    logger.dev('[secrets] infisical auth:access-token', {
      projectId: config.projectId,
      environment: config.environment,
    })
    return sdk.auth().accessToken(config.accessToken as string)
  }

  if (hasUniversalAuth(config)) {
    logger.dev('[secrets] infisical auth:universal-auth', {
      projectId: config.projectId,
      environment: config.environment,
    })
    return sdk.auth().universalAuth.login({
      clientId: config.clientId as string,
      clientSecret: config.clientSecret as string,
    })
  }

  return null
}

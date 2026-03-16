import type { InfisicalSDK } from '@infisical/sdk'
import { logger } from '@shared/lib/logger'
import type { InfisicalConfig, SecretEntry } from './types'
import { authenticateInfisicalClient } from './infisical-client'
import { resolveSecretEntry } from './resolve-secret-entry'
import { getInfisicalConfig } from './utils/getInfisicalConfig'
import { initSecrets } from './utils/initSecrets'
import { normalizeSecretPath } from './utils/normalizeSecretPath'

function buildCacheKey(keyName: string, normalizedPath: string | null) {
  return `${keyName}::${normalizedPath ?? ''}`
}

export class InfisicalSecrets {
  private clientPromise: Promise<InfisicalSDK | null> | null = null
  private readonly valueCache = new Map<string, SecretEntry | null>()

  init() {
    initSecrets()
  }

  private async getClient(config: InfisicalConfig) {
    if (!this.clientPromise) {
      this.clientPromise = authenticateInfisicalClient(config)
    }

    try {
      const client = await this.clientPromise
      logger.dev('[secrets] infisical auth:ok')
      return client
    } catch (error) {
      logger.dev('[secrets] infisical auth:error', {
        message: error instanceof Error ? error.message : 'Unknown login error',
      })
      this.clientPromise = null
      return null
    }
  }

  async get(keyName: string, secretPath?: string | null): Promise<SecretEntry | null> {
    this.init()
    const normalizedPath = normalizeSecretPath(secretPath)
    const cacheKey = buildCacheKey(keyName, normalizedPath)
    const config = getInfisicalConfig()

    if (this.valueCache.has(cacheKey)) {
      return this.valueCache.get(cacheKey) ?? null
    }

    logger.dev('[secrets] config', {
      hasConfig: Boolean(config),
      authMode: config?.accessToken
        ? 'access-token'
        : config?.clientId && config?.clientSecret
          ? 'universal-auth'
          : 'none',
      projectId: config?.projectId ?? null,
      environment: config?.environment ?? null,
      siteUrl: config?.siteUrl ?? 'https://app.infisical.com',
      keyName,
      secretPath: normalizedPath,
    })

    const resolved = await resolveSecretEntry({
      config,
      getClient: (nextConfig) => this.getClient(nextConfig),
      keyName,
      normalizedPath,
    })
    this.valueCache.set(cacheKey, resolved)
    return resolved
  }

  async preload(requests: Array<{ keyName: string; secretPath?: string | null }>) {
    for (const request of requests) {
      await this.get(request.keyName, request.secretPath)
    }
  }
}

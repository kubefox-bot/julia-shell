import type { InfisicalSDK } from '@infisical/sdk'
import { logger } from '../../shared/lib/logger'
import { authenticateInfisicalClient } from './infisical-client'
import { resolveSecretEntry } from './resolve-secret-entry'
import type { InfisicalConfig, SecretEntry } from './types'
import { getInfisicalConfig } from './utils/getInfisicalConfig'
import { initSecrets } from './utils/initSecrets'
import { normalizeSecretPath } from './utils/normalizeSecretPath'

export class InfisicalSecrets {
  private clientPromise: Promise<InfisicalSDK | null> | null = null
  private readonly valueCache = new Map<string, SecretEntry | null>()

  private buildCacheKey(keyName: string, normalizedPath: string | null) {
    return `${keyName}::${normalizedPath ?? ''}`
  }

  private init() {
    initSecrets()
  }

  private async getClient(config: InfisicalConfig) {
    this.clientPromise ??= authenticateInfisicalClient(config)
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

  private async resolve(keyName: string, normalizedPath: string | null): Promise<SecretEntry | null> {
    this.init()
    const config = getInfisicalConfig()
    return resolveSecretEntry({ config, getClient: (value) => this.getClient(value), keyName, normalizedPath })
  }

  async get(keyName: string, secretPath?: string | null): Promise<SecretEntry | null> {
    const normalizedPath = normalizeSecretPath(secretPath)
    const cacheKey = this.buildCacheKey(keyName, normalizedPath)
    if (this.valueCache.has(cacheKey)) {
      return this.valueCache.get(cacheKey) ?? null
    }

    const resolved = await this.resolve(keyName, normalizedPath)
    this.valueCache.set(cacheKey, resolved)
    return resolved
  }

  async preload(requests: Array<{ keyName: string; secretPath?: string | null }>) {
    for (const request of requests) {
      await this.get(request.keyName, request.secretPath)
    }
  }
}

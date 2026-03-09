import { InfisicalSDK } from '@infisical/sdk'
import { logger } from '@shared/lib/logger'
import type { InfisicalConfig, SecretEntry } from './types'
import { getInfisicalConfig } from './utils/getInfisicalConfig'
import { initSecrets } from './utils/initSecrets'
import { normalizeSecretPath } from './utils/normalizeSecretPath'

export class InfisicalSecrets {
  private clientPromise: Promise<InfisicalSDK | null> | null = null
  private readonly valueCache = new Map<string, SecretEntry | null>()

  init() {
    initSecrets()
  }

  private buildCacheKey(keyName: string, normalizedPath: string | null) {
    return `${keyName}::${normalizedPath ?? ''}`
  }

  private async getClient(config: InfisicalConfig) {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const sdk = new InfisicalSDK({
          siteUrl: config.siteUrl,
        })

        if (config.accessToken) {
          logger.dev('[secrets] infisical auth:access-token', {
            siteUrl: config.siteUrl ?? 'https://app.infisical.com',
            projectId: config.projectId,
            environment: config.environment,
          })

          return sdk.auth().accessToken(config.accessToken)
        }

        if (config.clientId && config.clientSecret) {
          logger.dev('[secrets] infisical auth:universal-auth', {
            siteUrl: config.siteUrl ?? 'https://app.infisical.com',
            projectId: config.projectId,
            environment: config.environment,
          })

          return sdk.auth().universalAuth.login({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
          })
        }

        return null
      })()
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

  private async resolve(keyName: string, normalizedPath: string | null): Promise<SecretEntry | null> {
    this.init()
    const config = getInfisicalConfig()

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

    if (config && normalizedPath) {
      const client = await this.getClient(config)

      if (client) {
        try {
          logger.dev('[secrets] infisical get:start', {
            projectId: config.projectId,
            environment: config.environment,
            keyName,
            secretPath: normalizedPath,
          })

          const secret = await client.secrets().getSecret({
            environment: config.environment,
            projectId: config.projectId,
            secretName: keyName,
            secretPath: normalizedPath,
            viewSecretValue: true,
          })

          const value = secret.secretValue?.trim()
          if (value) {
            logger.dev('[secrets] infisical hit', {
              keyName,
              secretPath: normalizedPath,
            })
            return {
              value,
              source: 'infisical',
              path: normalizedPath,
              reference: secret.secretKey,
            }
          }
        } catch (error) {
          logger.dev('[secrets] infisical get:error', {
            projectId: config.projectId,
            environment: config.environment,
            keyName,
            secretPath: normalizedPath,
            message: error instanceof Error ? error.message : 'Unknown getSecret error',
          })
        }
      }
    }

    const envValue = process.env[keyName]?.trim()
    if (!envValue) {
      logger.dev('[secrets] miss', {
        keyName,
        secretPath: normalizedPath,
      })
      return null
    }

    logger.dev('[secrets] env hit', {
      keyName,
      value: envValue,
    })
    return {
      value: envValue,
      source: 'env',
      path: null,
      reference: keyName,
    }
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

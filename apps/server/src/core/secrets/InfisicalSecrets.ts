import { InfisicalSDK } from '@infisical/sdk'
import { ResultAsync, type Result } from 'neverthrow'
import { logger } from '@shared/lib/logger'
import { toErrorMessage } from '@/shared/utils'
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

  private resolveAuthClient(config: InfisicalConfig, sdk: InfisicalSDK): Promise<InfisicalSDK | null> {
    if (config.accessToken) {
      logger.dev('[secrets] infisical auth:access-token', {
        siteUrl: config.siteUrl ?? 'https://app.infisical.com',
        environment: config.environment,
      })

      return Promise.resolve(sdk.auth().accessToken(config.accessToken))
    }

    if (config.clientId && config.clientSecret) {
      logger.dev('[secrets] infisical auth:universal-auth', {
        siteUrl: config.siteUrl ?? 'https://app.infisical.com',
        environment: config.environment,
      })

      return sdk.auth().universalAuth.login({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      })
    }

    return Promise.resolve(null)
  }

  private async getClient(config: InfisicalConfig): Promise<Result<InfisicalSDK | null, string>> {
    if (!this.clientPromise) {
      const sdk = new InfisicalSDK({
        siteUrl: config.siteUrl,
      })

      this.clientPromise = this.resolveAuthClient(config, sdk)
    }

    const clientResult = await ResultAsync.fromPromise(
      this.clientPromise,
      (error) => toErrorMessage(error, 'Unknown login error')
    )

    if (clientResult.isOk()) {
      logger.dev('[secrets] infisical auth:ok')
      return clientResult
    }

    logger.dev('[secrets] infisical auth:error', {
      message: clientResult.error,
    })
    this.clientPromise = null
    return clientResult
  }

  private async resolve(keyName: string, normalizedPath: string | null): Promise<SecretEntry | null> {
    this.init()
    const config = getInfisicalConfig()

    logger.dev('[secrets] config', {
      hasConfig: Boolean(config),
      environment: config?.environment ?? null,
      siteUrl: config?.siteUrl ?? 'https://app.infisical.com',
      keyName,
      secretPath: normalizedPath,
    })

    if (config && normalizedPath) {
      const clientResult = await this.getClient(config)
      const infisicalResolved = await clientResult.match(
        async (client) => {
          if (!client) {
            return null
          }

          logger.dev('[secrets] infisical get:start', {
            environment: config.environment,
            keyName,
            secretPath: normalizedPath,
          })

          const secretResult = await ResultAsync.fromPromise(
            client.secrets().getSecret({
              environment: config.environment,
              projectId: config.projectId,
              secretName: keyName,
              secretPath: normalizedPath,
              viewSecretValue: true,
            }),
            (error) => toErrorMessage(error, 'Unknown getSecret error')
          ).map((secret) => {
            const value = secret.secretValue?.trim()
            if (!value) {
              return null
            }

            return {
              value,
              source: 'infisical',
              path: normalizedPath,
              reference: secret.secretKey,
            } satisfies SecretEntry
          })

          return secretResult.match(
            (entry) => {
              if (!entry) {
                return null
              }

              logger.dev('[secrets] infisical hit', {
                keyName,
                secretPath: normalizedPath,
              })
              return entry
            },
            (errorMessage) => {
              logger.dev('[secrets] infisical get:error', {
                environment: config.environment,
                keyName,
                secretPath: normalizedPath,
                message: errorMessage,
              })
              return null
            }
          )
        },
        () => null
      )

      if (infisicalResolved) {
        return infisicalResolved
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

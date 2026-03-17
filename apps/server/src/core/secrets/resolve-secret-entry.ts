import type { InfisicalSDK } from '@infisical/sdk'
import { Option, Result, match } from 'oxide.ts'
import { logger } from '../../shared/lib/logger'
import type { InfisicalConfig, SecretEntry } from './types'

type ResolveSecretInput = {
  config: InfisicalConfig | null
  getClient: (config: InfisicalConfig) => Promise<InfisicalSDK | null>
  keyName: string
  normalizedPath: string | null
}

async function resolveFromInfisical(input: ResolveSecretInput): Promise<SecretEntry | null> {
  if (!input.config || !input.normalizedPath) {
    return null
  }
  const config = input.config
  const normalizedPath = input.normalizedPath

  const client = await input.getClient(config)
  return match(Option.from(client), {
    Some: async (resolvedClient) => {
      const secretResult = await Result.safe(resolvedClient.secrets().getSecret({
        environment: config.environment,
        projectId: config.projectId,
        secretName: input.keyName,
        secretPath: normalizedPath,
        viewSecretValue: true,
      }))

      return match(secretResult, {
        Ok: (secret) => match(Option(secret.secretValue?.trim()), {
          Some: (value) => ({
            value,
            source: 'infisical',
            path: normalizedPath,
            reference: secret.secretKey ?? input.keyName,
          } satisfies SecretEntry),
          None: () => null
        }),
        Err: (error) => {
          logger.dev('[secrets] infisical get:error', {
            keyName: input.keyName,
            secretPath: normalizedPath,
            message: error.message,
          })
          return null
        }
      })
    },
    None: async () => null
  })
}

function resolveFromEnv(keyName: string): SecretEntry | null {
  return match(Option(process.env[keyName]?.trim()), {
    Some: (envValue) => ({
      value: envValue,
      source: 'env',
      path: null,
      reference: keyName
    } satisfies SecretEntry),
    None: () => null
  })
}

export async function resolveSecretEntry(input: ResolveSecretInput): Promise<SecretEntry | null> {
  const infisicalEntry = await resolveFromInfisical(input)
  if (infisicalEntry) {
    logger.dev('[secrets] infisical hit', { keyName: input.keyName, secretPath: input.normalizedPath })
    return infisicalEntry
  }

  const envEntry = resolveFromEnv(input.keyName)
  if (envEntry) {
    logger.dev('[secrets] env hit', { keyName: input.keyName })
    return envEntry
  }

  logger.dev('[secrets] miss', { keyName: input.keyName, secretPath: input.normalizedPath })
  return null
}

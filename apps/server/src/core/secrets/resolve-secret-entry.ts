import type { InfisicalSDK } from '@infisical/sdk'
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

  const client = await input.getClient(input.config)
  if (!client) {
    return null
  }

  try {
    const secret = await client.secrets().getSecret({
      environment: input.config.environment,
      projectId: input.config.projectId,
      secretName: input.keyName,
      secretPath: input.normalizedPath,
      viewSecretValue: true,
    })
    const value = secret.secretValue?.trim()
    return value
      ? { value, source: 'infisical', path: input.normalizedPath, reference: secret.secretKey }
      : null
  } catch (error) {
    logger.dev('[secrets] infisical get:error', {
      keyName: input.keyName,
      secretPath: input.normalizedPath,
      message: error instanceof Error ? error.message : 'Unknown getSecret error',
    })
    return null
  }
}

function resolveFromEnv(keyName: string): SecretEntry | null {
  const envValue = process.env[keyName]?.trim()
  return envValue ? { value: envValue, source: 'env', path: null, reference: keyName } : null
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

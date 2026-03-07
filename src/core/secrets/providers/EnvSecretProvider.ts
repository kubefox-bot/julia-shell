import type { SecretLookupContext, SecretProvider, SecretResolution } from '../types'
import { resolveSecretNamespace } from '../utils/resolveSecretNamespace'

export class EnvSecretProvider implements SecretProvider {
  async resolveSecret(key: string, context?: SecretLookupContext) {
    const value = process.env[key]
    if (typeof value !== 'string') {
      return null
    }

    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    return {
      value: trimmed,
      source: 'env',
      secretName: key,
      envName: resolveSecretNamespace(context),
      secretPath: null,
      reference: key,
      editable: true,
    } satisfies SecretResolution
  }
}

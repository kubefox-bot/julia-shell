import type { SecretLookupContext, SecretProvider } from './types'

export class SecretProviderChain {
  constructor(private providers: SecretProvider[]) {}

  async resolveSecret(key: string, context?: SecretLookupContext) {
    for (const provider of this.providers) {
      const value = await provider.resolveSecret(key, context)
      if (value) {
        return value
      }
    }

    return null
  }

  async getSecret(key: string, context?: SecretLookupContext) {
    const resolved = await this.resolveSecret(key, context)
    return resolved?.value ?? null
  }
}

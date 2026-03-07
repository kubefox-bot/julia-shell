import { InfisicalSDK } from '@infisical/sdk'
import type { SecretLookupContext, SecretProvider, SecretResolution } from '../types'
import { getInfisicalConfig } from '../utils/getInfisicalConfig'
import { resolveSecretNamespace } from '../utils/resolveSecretNamespace'

export class InfisicalSecretProvider implements SecretProvider {
  private clientPromise: Promise<InfisicalSDK> | null = null

  private async getClient() {
    if (!this.clientPromise) {
      const config = getInfisicalConfig()
      if (!config) {
        return null
      }

      this.clientPromise = (async () => {
        const sdk = new InfisicalSDK({
          siteUrl: config.siteUrl,
        })

        return sdk.auth().universalAuth.login({
          clientId: config.clientId,
          clientSecret: config.clientSecret,
        })
      })()
    }

    try {
      return await this.clientPromise
    } catch {
      this.clientPromise = null
      return null
    }
  }

  async resolveSecret(key: string, context?: SecretLookupContext) {
    const config = getInfisicalConfig()
    const namespace = resolveSecretNamespace(context)
    if (!config || !namespace) {
      return null
    }

    const client = await this.getClient()
    if (!client) {
      return null
    }

    const secretPath = `/widgets/${namespace}`

    try {
      const secret = await client.secrets().getSecret({
        environment: 'main',
        projectId: config.projectId,
        secretName: key,
        secretPath,
        viewSecretValue: true,
      })

      if (!secret.secretValue?.trim()) {
        return null
      }

      return {
        value: secret.secretValue.trim(),
        source: 'infisical',
        secretName: key,
        envName: namespace,
        secretPath,
        reference: secret.secretKey,
        editable: false,
      } satisfies SecretResolution
    } catch {
      return null
    }
  }
}

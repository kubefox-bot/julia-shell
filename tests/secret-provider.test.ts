import { describe, expect, it } from 'vitest'
import { EnvSecretProvider } from '../src/core/secrets/providers/EnvSecretProvider'
import { SecretProviderChain } from '../src/core/secrets/SecretProviderChain'
import type { SecretProvider } from '../src/core/secrets/types'
import { normalizeSecretNamespace } from '../src/core/secrets/utils/normalizeSecretNamespace'
import { resolveSecretNamespace } from '../src/core/secrets/utils/resolveSecretNamespace'

describe('secret provider helpers', () => {
  it('normalizes env namespaces', () => {
    expect(normalizeSecretNamespace('Com.Yulia.Transcribe')).toBe('com-yulia-transcribe')
    expect(
      resolveSecretNamespace({ widgetId: 'com.yulia.transcribe', envName: 'transcribe' })
    ).toBe('transcribe')
    expect(resolveSecretNamespace({ widgetId: 'com.yulia.transcribe' })).toBe(
      'com-yulia-transcribe'
    )
  })

  it('respects provider chain priority', async () => {
    process.env.TEST_SECRET = 'env-value'

    const customProvider: SecretProvider = {
      resolveSecret: async () => ({
        value: 'custom',
        source: 'infisical',
        secretName: 'TEST_SECRET',
        envName: 'transcribe',
        secretPath: '/widgets/transcribe',
        reference: 'TEST_SECRET',
        editable: false,
      }),
    }

    const chain = new SecretProviderChain([customProvider, new EnvSecretProvider()])

    await expect(
      chain.getSecret('TEST_SECRET', { widgetId: 'com.yulia.transcribe' })
    ).resolves.toBe('custom')
    delete process.env.TEST_SECRET
  })
})

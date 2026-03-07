import { afterEach, describe, expect, it } from 'vitest'
import { InfisicalSecrets } from '../src/core/secrets/InfisicalSecrets'
import { normalizeSecretPath } from '../src/core/secrets/utils/normalizeSecretPath'

afterEach(() => {
  delete process.env.TEST_SECRET
})

describe('secrets', () => {
  it('normalizes secret paths', () => {
    expect(normalizeSecretPath('transcribe')).toBe('/transcribe')
    expect(normalizeSecretPath('/transcribe')).toBe('/transcribe')
    expect(normalizeSecretPath('//transcribe')).toBe('/transcribe')
    expect(normalizeSecretPath('   ')).toBeNull()
  })

  it('falls back to env when Infisical config is missing', async () => {
    process.env.TEST_SECRET = 'env-value'

    const secrets = new InfisicalSecrets()

    await expect(secrets.get('TEST_SECRET', 'transcribe')).resolves.toEqual({
      value: 'env-value',
      source: 'env',
      path: null,
      reference: 'TEST_SECRET',
    })
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { isChannelAuthorized } from '../src/shared/lib/channel-auth'

afterEach(() => {
  delete process.env.WIDGET_CHANNEL_TOKEN
  delete process.env.JULIAAPP_ENABLE_CHANNEL_AUTH
})

describe('channel token guard', () => {
  it('allows access when channel auth is disabled', async () => {
    process.env.WIDGET_CHANNEL_TOKEN = 'secret'
    const request = new Request('http://localhost/test', {
      headers: {
        'X-Widget-Token': 'wrong',
      },
    })

    await expect(isChannelAuthorized(request)).resolves.toBe(true)
  })

  it('rejects mismatched token when channel auth is enabled', async () => {
    process.env.JULIAAPP_ENABLE_CHANNEL_AUTH = '1'
    process.env.WIDGET_CHANNEL_TOKEN = 'secret'
    const request = new Request('http://localhost/test', {
      headers: {
        'X-Widget-Token': 'wrong',
      },
    })

    await expect(isChannelAuthorized(request)).resolves.toBe(false)
  })

  it('accepts matching token in strict mode', async () => {
    process.env.JULIAAPP_ENABLE_CHANNEL_AUTH = '1'
    process.env.WIDGET_CHANNEL_TOKEN = 'secret'
    const request = new Request('http://localhost/test', {
      headers: {
        'X-Widget-Token': 'secret',
      },
    })

    await expect(isChannelAuthorized(request)).resolves.toBe(true)
  })
})

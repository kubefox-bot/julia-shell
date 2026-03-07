import { afterEach, describe, expect, it } from 'vitest';
import { isChannelAuthorized } from '../src/shared/lib/channel-auth';

afterEach(() => {
  delete process.env.WIDGET_CHANNEL_TOKEN;
});

describe('channel token guard', () => {
  it('rejects when token is missing', async () => {
    process.env.WIDGET_CHANNEL_TOKEN = 'secret';
    const request = new Request('http://localhost/test', {
      headers: {
        'X-Widget-Token': 'wrong'
      }
    });

    await expect(isChannelAuthorized(request)).resolves.toBe(false);
  });

  it('accepts matching token', async () => {
    process.env.WIDGET_CHANNEL_TOKEN = 'secret';
    const request = new Request('http://localhost/test', {
      headers: {
        'X-Widget-Token': 'secret'
      }
    });

    await expect(isChannelAuthorized(request)).resolves.toBe(true);
  });
});

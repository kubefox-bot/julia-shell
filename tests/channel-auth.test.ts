import { afterEach, describe, expect, it } from 'vitest';
import { isChannelAuthorized } from '../src/shared/lib/channel-auth';

afterEach(() => {
  delete process.env.WIDGET_CHANNEL_TOKEN;
});

describe('channel token guard', () => {
  it('rejects when token is missing', () => {
    process.env.WIDGET_CHANNEL_TOKEN = 'secret';
    const request = new Request('http://localhost/test', {
      headers: {
        'X-Widget-Token': 'wrong'
      }
    });

    expect(isChannelAuthorized(request)).toBe(false);
  });

  it('accepts matching token', () => {
    process.env.WIDGET_CHANNEL_TOKEN = 'secret';
    const request = new Request('http://localhost/test', {
      headers: {
        'X-Widget-Token': 'secret'
      }
    });

    expect(isChannelAuthorized(request)).toBe(true);
  });
});

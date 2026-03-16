import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolvePassportRequestContextMock = vi.hoisted(() => vi.fn());

vi.mock('../src/domains/passport/server/context', () => ({
  resolvePassportRequestContext: resolvePassportRequestContextMock
}));

import { isChannelAuthorized } from '../src/shared/lib/auth/channel';

describe('channel auth via passport context', () => {
  beforeEach(() => {
    resolvePassportRequestContextMock.mockReset();
  });

  it('authorizes when passport context exists', async () => {
    resolvePassportRequestContextMock.mockResolvedValue({
      context: {
        agentId: 'agent-1',
        accessJwt: 'token',
        setCookieHeader: null
      },
      reason: 'missing'
    });

    await expect(isChannelAuthorized(new Request('http://localhost/test'))).resolves.toBe(true);
  });

  it('rejects when passport context is missing', async () => {
    resolvePassportRequestContextMock.mockResolvedValue({
      context: null,
      reason: 'missing'
    });

    await expect(isChannelAuthorized(new Request('http://localhost/test'))).resolves.toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolvePassportJwtSecretMock = vi.hoisted(() => vi.fn());

vi.mock('../server/config/jwt-secret', () => ({
  resolvePassportJwtSecret: resolvePassportJwtSecretMock
}));

import { buildPassportAccessCookie, extractAccessTokenFromRequest } from '../server/cookie';
import { resolvePassportRequestContext } from '../server/context';
import { issueAccessJwt, verifyAccessJwt } from '../server/jwt';

describe('passport jwt/cookie/context helpers', () => {
  beforeEach(() => {
    resolvePassportJwtSecretMock.mockReset();
  });

  it('issues and verifies access jwt', () => {
    const secret = 'secret';
    const token = issueAccessJwt(secret, 'agent-a');
    const claims = verifyAccessJwt(secret, token.token);
    expect(claims?.sub).toBe('agent-a');
    expect(claims?.aud).toBe('agent-control');
  });

  it('extracts cookie token before bearer token', () => {
    const request = new Request('http://localhost/test', {
      headers: {
        cookie: 'other=value; acess_token=cookie-token',
        Authorization: 'Bearer header-token'
      }
    });

    expect(extractAccessTokenFromRequest(request)).toEqual({
      token: 'cookie-token',
      source: 'cookie'
    });
  });

  it('resolves context from valid cookie token', async () => {
    resolvePassportJwtSecretMock.mockResolvedValue('secret');
    const token = issueAccessJwt('secret', 'agent-a').token;
    const request = new Request('http://localhost/test', {
      headers: {
        cookie: `acess_token=${token}`
      }
    });

    const resolved = await resolvePassportRequestContext(request);
    expect(resolved.context?.agentId).toBe('agent-a');
    expect(resolved.context?.setCookieHeader).toBeNull();
  });

  it('returns invalid when token cannot be verified', async () => {
    resolvePassportJwtSecretMock.mockResolvedValue('secret');
    const request = new Request('http://localhost/test', {
      headers: {
        cookie: 'acess_token=broken-token'
      }
    });

    const resolved = await resolvePassportRequestContext(request);
    expect(resolved.context).toBeNull();
    expect(resolved.reason).toBe('invalid');
  });

  it('does not bootstrap context when request token is missing', async () => {
    const request = new Request('https://example.com/test');
    const resolved = await resolvePassportRequestContext(request, {
      allowBootstrapFromOnlineAgent: true
    });

    expect(resolved.context).toBeNull();
    expect(resolved.reason).toBe('missing');
  });

  it('returns invalid when request token is broken even if bootstrap flag is set', async () => {
    resolvePassportJwtSecretMock.mockResolvedValue('secret');

    const request = new Request('https://example.com/test', {
      headers: {
        cookie: 'acess_token=broken-token'
      }
    });
    const resolved = await resolvePassportRequestContext(request, {
      allowBootstrapFromOnlineAgent: true
    });

    expect(resolved.context).toBeNull();
    expect(resolved.reason).toBe('invalid');
  });

  it('builds cookie policy for non-https without Secure', () => {
    const request = new Request('http://localhost/test');
    const cookie = buildPassportAccessCookie({
      token: 'token',
      request
    });

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Secure');
  });
});

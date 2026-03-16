import { beforeEach, describe, expect, it, vi } from 'vitest';

const secretsGetMock = vi.hoisted(() => vi.fn());

vi.mock('@core/secrets/secrets', () => ({
  secrets: {
    get: secretsGetMock
  }
}));

import { isPassportAdminAuthorized } from '../server/config/admin-auth';
import { resolvePassportJwtSecret } from '../server/config/jwt-secret';
import { createOpaqueToken, safeEqual, sha256 } from '../server/crypto';

const OPAQUE_TOKEN_BYTES = 16;
const OPAQUE_TOKEN_HEX_LENGTH = 32;

describe('passport server config/admin/crypto helpers', () => {
  beforeEach(() => {
    secretsGetMock.mockReset();
  });

  it('resolves AGENT_JWT_SECRET from secrets chain', async () => {
    secretsGetMock.mockResolvedValue({
      value: 'secret-from-store',
      source: 'env',
      path: '/',
      reference: 'AGENT_JWT_SECRET'
    });

    await expect(resolvePassportJwtSecret()).resolves.toBe('secret-from-store');
  });

  it('throws when AGENT_JWT_SECRET is missing', async () => {
    secretsGetMock.mockResolvedValue(null);
    await expect(resolvePassportJwtSecret()).rejects.toThrow(
      'Missing required startup secret: AGENT_JWT_SECRET'
    );
  });

  it('validates admin token with constant-time comparison', async () => {
    secretsGetMock.mockResolvedValue({
      value: 'admin-secret',
      source: 'env',
      path: '/',
      reference: 'ADMIN_TOKEN'
    });

    const accepted = await isPassportAdminAuthorized(
      new Request('http://localhost/test', {
        headers: { 'X-Admin-Token': 'admin-secret' }
      })
    );
    const rejected = await isPassportAdminAuthorized(
      new Request('http://localhost/test', {
        headers: { 'X-Admin-Token': 'wrong' }
      })
    );

    expect(accepted).toBe(true);
    expect(rejected).toBe(false);
  });

  it('hashes and compares values via crypto helpers', () => {
    const token = createOpaqueToken(OPAQUE_TOKEN_BYTES);
    expect(token).toHaveLength(OPAQUE_TOKEN_HEX_LENGTH);
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

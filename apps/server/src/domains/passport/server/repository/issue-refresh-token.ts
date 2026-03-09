import { randomUUID } from 'node:crypto';
import { agentTokensTable } from '../../../../core/db/passport-schema';
import { nowIso } from '../../../../shared/lib/time';
import { PASSPORT_REFRESH_TOKEN_BYTES, PASSPORT_TOKEN_TYPE_REFRESH } from '../consts';
import { createOpaqueToken, sha256 } from '../crypto';
import { buildRefreshTokenExpiresAt } from './dates';
import { getPassportDb } from './db';

export function issueRefreshToken(agentId: string) {
  const db = getPassportDb();
  const token = createOpaqueToken(PASSPORT_REFRESH_TOKEN_BYTES);
  const tokenHash = sha256(token);
  const now = nowIso();
  const expiresAt = buildRefreshTokenExpiresAt(now);

  db.insert(agentTokensTable)
    .values({
      id: randomUUID(),
      agentId,
      tokenType: PASSPORT_TOKEN_TYPE_REFRESH,
      tokenHash,
      issuedAt: now,
      expiresAt,
      revokedAt: null
    })
    .run();

  return {
    refreshToken: token,
    expiresAt
  };
}

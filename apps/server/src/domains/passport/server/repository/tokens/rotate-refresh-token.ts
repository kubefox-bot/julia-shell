import { and, eq, isNull } from 'drizzle-orm';
import { agentTokensTable } from '@passport/server/repository/shared/passport-schema';
import { nowIso } from '@shared/lib/time';
import { PASSPORT_TOKEN_TYPE_REFRESH } from '@passport/server/config/consts';
import { sha256 } from '@passport/server/crypto';
import { getPassportDb } from '@passport/server/repository/shared';
import { issueRefreshToken } from './issue-refresh-token';
import { isExpiredIso } from '@passport/server/repository/shared';

export function rotateRefreshToken(agentId: string, refreshToken: string) {
  const db = getPassportDb();
  const tokenHash = sha256(refreshToken);
  const row = db
    .select()
    .from(agentTokensTable)
    .where(and(
      eq(agentTokensTable.agentId, agentId),
      eq(agentTokensTable.tokenHash, tokenHash),
      eq(agentTokensTable.tokenType, PASSPORT_TOKEN_TYPE_REFRESH)
    ))
    .get();

  if (!row || row.revokedAt || isExpiredIso(row.expiresAt)) {
    return null;
  }

  const revokeResult = db
    .update(agentTokensTable)
    .set({ revokedAt: nowIso() })
    .where(and(
      eq(agentTokensTable.id, row.id),
      isNull(agentTokensTable.revokedAt)
    ))
    .run();

  if (revokeResult.changes <= 0) {
    return null;
  }

  return issueRefreshToken(agentId);
}

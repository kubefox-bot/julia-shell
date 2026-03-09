import { and, eq, isNull } from 'drizzle-orm';
import { agentTokensTable } from '@core/db/passport-schema';
import { nowIso } from '@/shared/lib/time';
import { PASSPORT_TOKEN_TYPE_REFRESH } from '@passport/server/config/consts';
import { sha256 } from '@passport/server/crypto';
import { getPassportDb } from '@passport/server/repository/shared';

export function revokeRefreshToken(agentId: string, refreshToken: string) {
  const db = getPassportDb();
  const tokenHash = sha256(refreshToken);

  const result = db
    .update(agentTokensTable)
    .set({ revokedAt: nowIso() })
    .where(and(
      eq(agentTokensTable.agentId, agentId),
      eq(agentTokensTable.tokenHash, tokenHash),
      eq(agentTokensTable.tokenType, PASSPORT_TOKEN_TYPE_REFRESH),
      isNull(agentTokensTable.revokedAt)
    ))
    .run();

  return result.changes > 0;
}

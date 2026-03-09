import { and, eq, isNull } from 'drizzle-orm';
import { agentEnrollmentTokensTable } from '../../../../core/db/passport-schema';
import { nowIso } from '../../../../shared/lib/time';
import { getPassportDb } from './db';

export function revokeEnrollmentToken(tokenId: string) {
  const db = getPassportDb();
  const result = db
    .update(agentEnrollmentTokensTable)
    .set({ revokedAt: nowIso() })
    .where(and(
      eq(agentEnrollmentTokensTable.id, tokenId),
      isNull(agentEnrollmentTokensTable.revokedAt)
    ))
    .run();

  return result.changes > 0;
}

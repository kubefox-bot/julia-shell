import { and, eq } from 'drizzle-orm';
import { agentEnrollmentTokensTable } from '../../../../core/db/passport-schema';
import { nowIso } from '../../../../shared/lib/time';
import { sha256 } from '../crypto';
import { getPassportDb } from './db';
import { isExpiredIso } from './time';

/**
 * Consumes enrollment token only when `(agent_id, token)` pair is valid.
 */
export function consumeEnrollmentToken(rawToken: string, agentId: string) {
  const db = getPassportDb();
  const tokenHash = sha256(rawToken);
  const row = db
    .select()
    .from(agentEnrollmentTokensTable)
    .where(and(
      eq(agentEnrollmentTokensTable.tokenHash, tokenHash),
      eq(agentEnrollmentTokensTable.agentId, agentId)
    ))
    .get();

  if (!row || row.revokedAt || isExpiredIso(row.expiresAt) || row.usesLeft <= 0) {
    return null;
  }

  const nextUsesLeft = row.usesLeft - 1;
  const usedAt = nextUsesLeft === 0 ? nowIso() : row.usedAt;

  const result = db
    .update(agentEnrollmentTokensTable)
    .set({
      usesLeft: nextUsesLeft,
      usedAt
    })
    .where(and(
      eq(agentEnrollmentTokensTable.id, row.id),
      eq(agentEnrollmentTokensTable.usesLeft, row.usesLeft)
    ))
    .run();

  if (result.changes <= 0) {
    return null;
  }

  return {
    tokenId: row.id,
    agentId: row.agentId,
    usesLeft: nextUsesLeft
  };
}

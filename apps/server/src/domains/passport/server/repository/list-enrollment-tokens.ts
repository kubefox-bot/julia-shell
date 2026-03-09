import { desc } from 'drizzle-orm';
import { agentEnrollmentTokensTable } from '../../../../core/db/passport-schema';
import { getPassportDb } from './db';

export function listEnrollmentTokens() {
  const db = getPassportDb();
  const rows = db
    .select()
    .from(agentEnrollmentTokensTable)
    .orderBy(desc(agentEnrollmentTokensTable.createdAt))
    .all();

  return rows.map((row) => ({
    tokenId: row.id,
    agentId: row.agentId,
    label: row.label,
    usesTotal: row.usesTotal,
    usesLeft: row.usesLeft,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    revokedAt: row.revokedAt
  }));
}

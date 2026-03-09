import { eq } from 'drizzle-orm';
import { agentRegistryTable } from '../../../../core/db/passport-schema';
import { getPassportDb } from './db';

export function getAgentDisplayName(agentId: string) {
  const db = getPassportDb();
  const row = db
    .select({ displayName: agentRegistryTable.displayName })
    .from(agentRegistryTable)
    .where(eq(agentRegistryTable.agentId, agentId))
    .get();

  return row?.displayName?.trim() || null;
}

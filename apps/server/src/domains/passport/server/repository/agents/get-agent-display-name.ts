import { eq } from 'drizzle-orm';
import { agentRegistryTable } from '@passport/server/repository/shared/passport-schema';
import { getPassportDb } from '@passport/server/repository/shared';

export function getAgentDisplayName(agentId: string) {
  const db = getPassportDb();
  const row = db
    .select({ displayName: agentRegistryTable.displayName })
    .from(agentRegistryTable)
    .where(eq(agentRegistryTable.agentId, agentId))
    .get();

  return row?.displayName?.trim() || null;
}

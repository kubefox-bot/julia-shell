import { and, desc, eq, gte } from 'drizzle-orm';
import { agentSessionsTable } from '@passport/server/repository/shared/passport-schema';
import { PASSPORT_AGENT_STATUS_ONLINE } from '@passport/server/config/consts';
import { getPassportDb } from '@passport/server/repository/shared';

export function getAnyOnlineAgentSession(input?: { minHeartbeatAt?: string }) {
  const db = getPassportDb();
  const filters = [eq(agentSessionsTable.status, PASSPORT_AGENT_STATUS_ONLINE)];

  if (input?.minHeartbeatAt) {
    filters.push(gte(agentSessionsTable.lastHeartbeatAt, input.minHeartbeatAt));
  }

  const row = db
    .select({
      sessionId: agentSessionsTable.sessionId,
      agentId: agentSessionsTable.agentId,
      status: agentSessionsTable.status,
      connectedAt: agentSessionsTable.connectedAt,
      lastHeartbeatAt: agentSessionsTable.lastHeartbeatAt
    })
    .from(agentSessionsTable)
    .where(and(...filters))
    .orderBy(desc(agentSessionsTable.lastHeartbeatAt))
    .get();

  return row ?? null;
}

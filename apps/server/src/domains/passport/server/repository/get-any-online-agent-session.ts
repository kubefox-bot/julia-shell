import { and, desc, eq, gte } from 'drizzle-orm';
import { agentSessionsTable } from '../../../../core/db/passport-schema';
import { PASSPORT_AGENT_STATUS_ONLINE } from '../consts';
import { getPassportDb } from './db';

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

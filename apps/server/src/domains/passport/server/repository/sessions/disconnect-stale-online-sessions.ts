import { and, eq, lt } from 'drizzle-orm';
import { agentSessionsTable } from '@/core/db/passport-schema';
import { nowIso } from '@/shared/lib/time';
import { PASSPORT_AGENT_STATUS_DISCONNECTED, PASSPORT_AGENT_STATUS_ONLINE } from '@passport/server/config/consts';
import type { DisconnectStaleSessionsInput } from '@passport/server/types';
import { getPassportDb } from '@passport/server/repository/shared';

export function disconnectStaleOnlineSessions(input: DisconnectStaleSessionsInput) {
  const db = getPassportDb();
  const now = nowIso();
  const reason = input.reason ?? 'heartbeat_timeout';

  const result = db
    .update(agentSessionsTable)
    .set({
      status: PASSPORT_AGENT_STATUS_DISCONNECTED,
      disconnectedAt: now,
      disconnectReason: reason
    })
    .where(and(
      eq(agentSessionsTable.status, PASSPORT_AGENT_STATUS_ONLINE),
      lt(agentSessionsTable.lastHeartbeatAt, input.cutoffIso)
    ))
    .run();

  return result.changes;
}

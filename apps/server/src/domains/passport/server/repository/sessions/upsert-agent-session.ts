import { agentSessionsTable } from '@/core/db/passport-schema';
import { nowIso } from '@shared/lib/time';
import { PASSPORT_AGENT_STATUS_DISCONNECTED } from '@passport/server/config/consts';
import type { UpsertAgentSessionInput } from '@passport/server/types';
import { getPassportDb } from '@passport/server/repository/shared';

export function upsertAgentSession(input: UpsertAgentSessionInput) {
  const db = getPassportDb();
  const now = nowIso();
  const isDisconnected = input.status === PASSPORT_AGENT_STATUS_DISCONNECTED;

  db.insert(agentSessionsTable)
    .values({
      sessionId: input.sessionId,
      agentId: input.agentId,
      status: input.status,
      connectedAt: now,
      lastHeartbeatAt: now,
      disconnectedAt: isDisconnected ? now : null,
      disconnectReason: isDisconnected ? (input.disconnectReason ?? null) : null
    })
    .onConflictDoUpdate({
      target: agentSessionsTable.sessionId,
      set: isDisconnected
        ? {
            status: input.status,
            lastHeartbeatAt: now,
            disconnectedAt: now,
            disconnectReason: input.disconnectReason ?? null
          }
        : {
            status: input.status,
            lastHeartbeatAt: now
          }
    })
    .run();
}

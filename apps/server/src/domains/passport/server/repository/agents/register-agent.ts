import { agentRegistryTable } from '@passport/server/repository/shared/passport-schema';
import { nowIso } from '@shared/lib/time';
import { PASSPORT_AGENT_STATUS_ONLINE } from '@passport/server/config/consts';
import { resolveAgentDisplayName, resolveAgentVersion, serializeAgentCapabilities } from '@passport/server/models';
import type { RegisterAgentInput } from '@passport/server/types';
import { getPassportDb } from '@passport/server/repository/shared';

/**
 * Upserts agent record after successful enroll.
 */
export function registerAgent(input: RegisterAgentInput) {
  const db = getPassportDb();
  const now = nowIso();
  const displayName = resolveAgentDisplayName(input.displayName);
  const version = resolveAgentVersion(input.version);
  const capabilitiesJson = serializeAgentCapabilities(input.capabilities);

  db.insert(agentRegistryTable)
    .values({
      agentId: input.agentId,
      displayName,
      status: PASSPORT_AGENT_STATUS_ONLINE,
      capabilitiesJson,
      version,
      createdAt: now,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: agentRegistryTable.agentId,
      set: {
        displayName,
        status: PASSPORT_AGENT_STATUS_ONLINE,
        capabilitiesJson,
        version,
        updatedAt: now
      }
    })
    .run();

  return input.agentId;
}

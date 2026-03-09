import { randomUUID } from 'node:crypto';
import { agentEnrollmentTokensTable, agentRegistryTable } from '@/core/db/passport-schema';
import { nowIso } from '@shared/lib/time';
import {
  PASSPORT_ENROLLMENT_TOKEN_BYTES,
  PASSPORT_AGENT_STATUS_ENROLLMENT_PENDING
} from '@passport/server/config/consts';
import { createOpaqueToken, sha256 } from '@passport/server/crypto';
import { resolveAgentDisplayName } from '@passport/server/models';
import type { CreateEnrollmentTokenInput } from '@passport/server/types';
import { buildEnrollmentTokenExpiresAt } from '@passport/server/repository/shared';
import { getPassportDb } from '@passport/server/repository/shared';
import { resolveEnrollmentTtlMinutes, resolveEnrollmentUses } from '@passport/server/repository/shared';

/**
 * Issues one-time enrollment token and reserves `agent_id` for first auth.
 */
export function createEnrollmentToken(input: CreateEnrollmentTokenInput) {
  const db = getPassportDb();
  const now = nowIso();
  const ttlMinutes = resolveEnrollmentTtlMinutes(input.ttlMinutes);
  const uses = resolveEnrollmentUses(input.uses);
  const agentId = input.agentId?.trim() || randomUUID();

  const enrollmentToken = createOpaqueToken(PASSPORT_ENROLLMENT_TOKEN_BYTES);
  const tokenHash = sha256(enrollmentToken);
  const tokenId = randomUUID();
  const expiresAt = buildEnrollmentTokenExpiresAt(ttlMinutes, now);

  db.insert(agentRegistryTable)
    .values({
      agentId,
      displayName: resolveAgentDisplayName(input.label),
      status: PASSPORT_AGENT_STATUS_ENROLLMENT_PENDING,
      capabilitiesJson: JSON.stringify([]),
      version: 'unknown',
      createdAt: now,
      updatedAt: now
    })
    .onConflictDoNothing({ target: agentRegistryTable.agentId })
    .run();

  db.insert(agentEnrollmentTokensTable)
    .values({
      id: tokenId,
      agentId,
      tokenHash,
      label: input.label?.trim() || null,
      usesTotal: uses,
      usesLeft: uses,
      createdAt: now,
      expiresAt,
      usedAt: null,
      revokedAt: null
    })
    .run();

  return {
    tokenId,
    agentId,
    enrollmentToken,
    expiresAt,
    uses
  };
}

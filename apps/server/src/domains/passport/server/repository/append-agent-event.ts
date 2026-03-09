import { randomUUID } from 'node:crypto';
import { agentEventsTable } from '../../../../core/db/passport-schema';
import { nowIso } from '../../../../shared/lib/time';
import type { AppendAgentEventInput } from '../types';
import { getPassportDb } from './db';

export function appendAgentEvent(input: AppendAgentEventInput) {
  const db = getPassportDb();
  db.insert(agentEventsTable)
    .values({
      id: randomUUID(),
      agentId: input.agentId,
      sessionId: input.sessionId ?? null,
      jobId: input.jobId ?? null,
      eventType: input.eventType,
      payloadJson: JSON.stringify(input.payload ?? null),
      receivedAt: nowIso()
    })
    .run();
}

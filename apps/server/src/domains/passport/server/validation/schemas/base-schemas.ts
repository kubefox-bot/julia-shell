import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { agentEnrollmentTokensTable, agentRegistryTable } from '@core/db/passport-schema'

const passportAgentRegistrySelectSchema = createSelectSchema(agentRegistryTable)
const passportEnrollmentTokenSelectSchema = createSelectSchema(agentEnrollmentTokensTable)
const passportEnrollmentTokenInsertSchema = createInsertSchema(agentEnrollmentTokensTable)

const trimmedNonEmptyStringSchema = z.string().trim().min(1)

/**
 * Canonical `agent_id` schema derived from passport registry table.
 */
export const passportAgentIdSchema = passportAgentRegistrySelectSchema.shape.agentId
  .transform((value) => value.trim())
  .pipe(trimmedNonEmptyStringSchema)

/**
 * Canonical enrollment `token_id` schema derived from passport enrollment table.
 */
export const passportEnrollmentTokenIdSchema = passportEnrollmentTokenSelectSchema.shape.id
  .transform((value) => value.trim())
  .pipe(trimmedNonEmptyStringSchema)

/**
 * Canonical enrollment `uses` schema derived from passport enrollment table.
 */
export const passportEnrollmentUsesSchema = passportEnrollmentTokenInsertSchema.shape.usesTotal
  .int()
  .min(1)

/**
 * Enrollment token passed by agent during first-time auth.
 */
export const passportEnrollmentTokenSchema = z.string().trim().min(1)

/**
 * Refresh token passed by agent for rotation/revoke.
 */
export const passportRefreshTokenSchema = z.string().trim().min(1)

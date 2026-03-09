import { z } from 'zod'
import { passportAgentIdSchema, passportEnrollmentUsesSchema } from './base-schemas'

export const createEnrollmentTokenRequestSchema = z.object({
  agent_id: passportAgentIdSchema.optional(),
  ttl_minutes: z.number().int().min(1).optional(),
  uses: passportEnrollmentUsesSchema.optional(),
  label: z.string().trim().min(1).optional(),
})

export type CreateEnrollmentTokenRequest = z.infer<typeof createEnrollmentTokenRequestSchema>

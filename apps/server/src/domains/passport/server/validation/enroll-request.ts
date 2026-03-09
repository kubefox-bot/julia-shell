import { z } from 'zod'
import { passportAgentIdSchema, passportEnrollmentTokenSchema } from './base-schemas'

export const enrollRequestSchema = z.object({
  agent_id: passportAgentIdSchema,
  enrollment_token: passportEnrollmentTokenSchema,
  device_info: z.string().optional(),
  agent_version: z.string().optional(),
  capabilities: z.unknown().optional(),
})

export type EnrollRequest = z.infer<typeof enrollRequestSchema>

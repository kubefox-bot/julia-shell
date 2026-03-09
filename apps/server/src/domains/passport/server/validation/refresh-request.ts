import { z } from 'zod'
import { passportAgentIdSchema, passportRefreshTokenSchema } from './base-schemas'

export const refreshRequestSchema = z.object({
  agent_id: passportAgentIdSchema,
  refresh_token: passportRefreshTokenSchema,
})

export type RefreshRequest = z.infer<typeof refreshRequestSchema>

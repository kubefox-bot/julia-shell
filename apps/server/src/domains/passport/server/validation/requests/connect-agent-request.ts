import { z } from 'zod'
import { passportAgentIdSchema } from '@passport/server/validation/schemas'

export const connectAgentRequestSchema = z.object({
  agent_id: passportAgentIdSchema,
})

export type ConnectAgentRequest = z.infer<typeof connectAgentRequestSchema>

import { z } from 'zod'
import { passportEnrollmentTokenIdSchema } from './base-schemas'

export const revokeEnrollmentTokenRequestSchema = z.object({
  token_id: passportEnrollmentTokenIdSchema,
})

export type RevokeEnrollmentTokenRequest = z.infer<typeof revokeEnrollmentTokenRequestSchema>

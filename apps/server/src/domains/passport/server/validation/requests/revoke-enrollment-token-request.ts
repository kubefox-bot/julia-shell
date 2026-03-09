import { z } from 'zod'
import { passportEnrollmentTokenIdSchema } from '@passport/server/validation/schemas'

export const revokeEnrollmentTokenRequestSchema = z.object({
  token_id: passportEnrollmentTokenIdSchema,
})

export type RevokeEnrollmentTokenRequest = z.infer<typeof revokeEnrollmentTokenRequestSchema>

import type { ZodType } from 'zod'
import type { PassportHttpErrorKey } from '../http'
import { createEnrollmentTokenRequestSchema } from './create-enrollment-token-request'
import { enrollRequestSchema } from './enroll-request'
import { refreshRequestSchema } from './refresh-request'
import { revokeEnrollmentTokenRequestSchema } from './revoke-enrollment-token-request'

type PassportValidationEntry<TSchema extends ZodType = ZodType> = {
  schema: TSchema
  errorKey: PassportHttpErrorKey
}

export const PASSPORT_VALIDATION_CATALOG = {
  createEnrollmentToken: {
    schema: createEnrollmentTokenRequestSchema,
    errorKey: 'invalidCreateEnrollmentTokenPayload',
  },
  enroll: {
    schema: enrollRequestSchema,
    errorKey: 'missingEnrollFields',
  },
  refresh: {
    schema: refreshRequestSchema,
    errorKey: 'missingRefreshFields',
  },
  revokeEnrollmentToken: {
    schema: revokeEnrollmentTokenRequestSchema,
    errorKey: 'missingTokenId',
  },
} as const satisfies Record<string, PassportValidationEntry>

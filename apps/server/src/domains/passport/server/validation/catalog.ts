import type { ZodType } from 'zod'
import type { PassportHttpErrorKey } from '@passport/server/http'
import {
  createEnrollmentTokenRequestSchema,
  enrollRequestSchema,
  refreshRequestSchema,
  revokeEnrollmentTokenRequestSchema
} from './requests'

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

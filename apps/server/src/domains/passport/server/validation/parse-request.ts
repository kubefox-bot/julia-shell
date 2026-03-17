import { Err, Ok, type Result } from '@shared/lib/result'
import type { ZodType } from 'zod'

export type PassportRequestValidationIssue = {
  path: ReadonlyArray<PropertyKey>
  message: string
}

export type PassportRequestValidationError = {
  message: string
  issues: ReadonlyArray<PassportRequestValidationIssue>
}

/**
 * Parses unknown JSON body with schema and returns typed `Result`.
 */
export function parseRequestBody<T>(
  schema: ZodType<T>,
  input: unknown
): Result<T, PassportRequestValidationError> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return Err({
      message: 'Validation failed.',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    })
  }

  return Ok<T>(parsed.data)
}

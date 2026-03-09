import { err, ok, type Result } from 'neverthrow'
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
    return err({
      message: 'Validation failed.',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    })
  }

  return ok<T>(parsed.data)
}

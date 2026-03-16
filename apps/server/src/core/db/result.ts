import { Err, Ok, type Result } from '@shared/lib/result'

export function runDb<T, E>(run: () => T, mapError: (error: unknown) => E): Result<T, E> {
  try {
    return Ok(run())
  } catch (error) {
    return Err(mapError(error))
  }
}

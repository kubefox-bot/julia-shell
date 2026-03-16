import { Err, Ok, type Result } from 'oxide.ts'

export function fromPromise<T, E>(
  promise: Promise<T>,
  mapError: (error: unknown) => E
): Promise<Result<T, E>> {
  return promise.then(
    (value) => Ok(value),
    (error) => Err(mapError(error))
  )
}

export function fromThrowablePromise<T>(promise: Promise<T>): Promise<Result<T, unknown>> {
  return fromPromise(promise, (error) => error)
}

export { Err, Ok, Option, match } from 'oxide.ts'

export function trySync<T, E>(run: () => T, mapError: (error: unknown) => E): Result<T, E> {
  try {
    return Ok(run())
  } catch (error) {
    return Err(mapError(error))
  }
}

export function tryAsync<T, E>(run: () => Promise<T>, mapError: (error: unknown) => E): Promise<Result<T, E>> {
  return fromPromise(run(), mapError)
}

export async function combineAsyncResults<T, E>(
  results: Array<Promise<Result<T, E>>>
): Promise<Result<T[], E>> {
  const values: T[] = []

  for (const resultPromise of results) {
    const result = await resultPromise
    if (result.isOk()) {
      values.push(result.unwrap())
      continue
    }

    return Err(result.unwrapErr())
  }

  return Ok(values)
}

export async function unwrapResultAsync<T, E>(result: Promise<Result<T, E>> | Result<T, E>) {
  const resolved = await result
  if (resolved.isErr()) {
    return Promise.reject(resolved.unwrapErr())
  }

  return resolved.unwrap()
}

export type { Result }

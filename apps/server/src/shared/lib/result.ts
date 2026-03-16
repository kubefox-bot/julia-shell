import { ResultAsync, type ResultAsync as ResultAsyncType } from 'neverthrow'

export function fromThrowablePromise<T>(promise: Promise<T>) {
  return ResultAsync.fromPromise(promise, (error) => error)
}

export function unwrapResultAsync<T, E>(result: ResultAsyncType<T, E>) {
  return result.match(
    (value) => value,
    (error) => Promise.reject(error)
  )
}

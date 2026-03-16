import { ResultAsync } from 'neverthrow'

export function fromThrowablePromise<T>(promise: Promise<T>) {
  return ResultAsync.fromPromise(promise, (error) => error)
}

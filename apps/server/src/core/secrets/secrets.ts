import { ResultAsync, err, ok } from 'neverthrow'
import { InfisicalSecrets } from './InfisicalSecrets'
import { REQUIRED_SECRET_KEYS, STARTUP_SECRET_KEYS, type RequiredSecretRequest } from './consts'

export const secrets = new InfisicalSecrets()

let preloadPromise: Promise<void> | null = null

function toError(error: unknown) {
  return error instanceof Error ? error : new Error('Unknown secret resolution error.')
}

function validateRequiredSecret(requiredSecret: RequiredSecretRequest) {
  return ResultAsync.fromPromise(
    secrets.get(requiredSecret.keyName, requiredSecret.secretPath),
    toError
  ).andThen((resolved) => {
    if (resolved?.value?.trim()) {
      return ok(undefined)
    }

    return err(new Error(`Missing required startup secret: ${requiredSecret.keyName}`))
  })
}

export function preloadServerSecretsOnce() {
  if (!preloadPromise) {
    preloadPromise = (async () => {
      await secrets.preload(Array.from(STARTUP_SECRET_KEYS))

      if (process.env.NODE_ENV === 'production') {
        const requiredSecretsResult = await ResultAsync.combine(
          REQUIRED_SECRET_KEYS.map((requiredSecret) => validateRequiredSecret(requiredSecret))
        )

        if (requiredSecretsResult.isErr()) {
          throw requiredSecretsResult.error
        }
      }
    })()
  }

  return preloadPromise
}

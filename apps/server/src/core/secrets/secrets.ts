import { combineAsyncResults, Err, Ok, tryAsync, type Result } from '@shared/lib/result'
import { InfisicalSecrets } from './InfisicalSecrets'
import { REQUIRED_SECRET_KEYS, STARTUP_SECRET_KEYS, type RequiredSecretRequest } from './consts'

export const secrets = new InfisicalSecrets()

let preloadPromise: Promise<void> | null = null

function toError(error: unknown) {
  return error instanceof Error ? error : new Error('Unknown secret resolution error.')
}

async function validateRequiredSecret(requiredSecret: RequiredSecretRequest): Promise<Result<void, Error>> {
  const resolvedResult = await tryAsync(
    () => secrets.get(requiredSecret.keyName, requiredSecret.secretPath),
    toError
  )

  if (resolvedResult.isErr()) {
    return Err(resolvedResult.unwrapErr())
  }

  if (resolvedResult.unwrap()?.value?.trim()) {
    return Ok(undefined)
  }

  return Err(new Error(`Missing required startup secret: ${requiredSecret.keyName}`))
}

export function preloadServerSecretsOnce() {
  if (!preloadPromise) {
    preloadPromise = (async () => {
      await secrets.preload(Array.from(STARTUP_SECRET_KEYS))

      if (process.env.NODE_ENV === 'production') {
        const requiredSecretsResult = await combineAsyncResults(
          REQUIRED_SECRET_KEYS.map((requiredSecret) => validateRequiredSecret(requiredSecret))
        )

        const [requiredSecretsError] = requiredSecretsResult.intoTuple()
        if (requiredSecretsError) {
          throw requiredSecretsError
        }
      }
    })()
  }

  return preloadPromise
}

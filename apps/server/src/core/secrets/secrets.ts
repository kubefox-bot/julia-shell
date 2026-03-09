import { InfisicalSecrets } from './InfisicalSecrets'

export const secrets = new InfisicalSecrets()

const STARTUP_SECRET_KEYS: Array<{ keyName: string; secretPath?: string }> = [
  { keyName: 'ADMIN_TOKEN', secretPath: '/' },
  { keyName: 'AGENT_JWT_SECRET', secretPath: '/' },
  { keyName: 'GEMINI_API_KEY', secretPath: '/transcribe' },
]

const REQUIRED_SECRET_KEYS = ['ADMIN_TOKEN', 'AGENT_JWT_SECRET'] as const

let preloadPromise: Promise<void> | null = null

export function preloadServerSecretsOnce() {
  if (!preloadPromise) {
    preloadPromise = (async () => {
      await secrets.preload(STARTUP_SECRET_KEYS)

      for (const keyName of REQUIRED_SECRET_KEYS) {
        const resolved = await secrets.get(keyName)
        if (!resolved?.value?.trim()) {
          throw new Error(`Missing required startup secret: ${keyName}`)
        }
      }
    })()
  }

  return preloadPromise
}

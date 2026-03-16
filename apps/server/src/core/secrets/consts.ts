export type StartupSecretRequest = {
  keyName: string
  secretPath?: string
}

export type RequiredSecretRequest = {
  keyName: string
  secretPath: string
}

export const STARTUP_SECRET_KEYS: ReadonlyArray<StartupSecretRequest> = [
  { keyName: 'ADMIN_TOKEN', secretPath: '/' },
  { keyName: 'AGENT_JWT_SECRET', secretPath: '/' },
  { keyName: 'GEMINI_API_KEY', secretPath: '/transcribe' },
]

export const REQUIRED_SECRET_KEYS: ReadonlyArray<RequiredSecretRequest> = [
  { keyName: 'AGENT_JWT_SECRET', secretPath: '/' },
]

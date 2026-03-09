import { terminalAgentManifest } from '../manifest'

export const WIDGET_ID = terminalAgentManifest.id

export const PROVIDER_CODEX = 'codex'
export const PROVIDER_GEMINI = 'gemini'

export const PROVIDERS = [
  { value: PROVIDER_CODEX, label: 'Codex' },
  { value: PROVIDER_GEMINI, label: 'Gemini CLI' },
] as const

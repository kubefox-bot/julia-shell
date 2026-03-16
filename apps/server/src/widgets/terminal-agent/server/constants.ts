import { TERMINAL_AGENT_WIDGET_ID } from '@/widgets'

export const WIDGET_ID = TERMINAL_AGENT_WIDGET_ID

export const PROVIDER_CODEX = 'codex'
export const PROVIDER_GEMINI = 'gemini'

export const PROVIDERS = [
  { value: PROVIDER_CODEX, label: 'Codex' },
  { value: PROVIDER_GEMINI, label: 'Gemini CLI' },
] as const

import { z } from 'zod'

export type LlmRuntimeProvider = 'codex' | 'gemini'

export type LlmRuntimeError = {
  code: 'db_error' | 'validation_error'
  message: string
}

export type LlmRuntimeSettings = {
  agentId: string
  consumer: string
  activeProvider: LlmRuntimeProvider
  codexApiKey: string
  geminiApiKey: string
  codexCommand: string
  codexArgs: string[]
  codexModel: string
  geminiCommand: string
  geminiArgs: string[]
  geminiModel: string
  useShellFallback: boolean
  shellOverride: string
  updatedAt: string | null
}

export type LlmRuntimeDialogState = {
  agentId: string
  consumer: string
  provider: LlmRuntimeProvider
  providerSessionRef: string
  dialogTitle: string
  status: string
  lastError: string | null
  updatedAt: string | null
}

export type LlmRuntimeDialogRef = {
  agentId: string
  consumer: string
  provider: LlmRuntimeProvider
  providerSessionRef: string
  dialogTitle: string
  createdAt: string
  updatedAt: string
  lastStatus: string
}

const providerSchema = z.enum(['codex', 'gemini'])
const argsSchema = z.array(z.string())

export function toProvider(value: unknown, fallback: LlmRuntimeProvider = 'codex'): LlmRuntimeProvider {
  const parsed = providerSchema.safeParse(value)
  return parsed.success ? parsed.data : fallback
}

export function toArgs(raw: unknown, fallback: string[]) {
  const parsed = argsSchema.safeParse(raw)
  if (!parsed.success) {
    return fallback
  }

  const normalized = parsed.data.map((item) => item.trim()).filter(Boolean)
  return normalized.length > 0 ? normalized : fallback
}

export function parseArgs(raw: string, fallback: string[]) {
  try {
    return toArgs(JSON.parse(raw), fallback)
  } catch {
    return fallback
  }
}

export function toText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

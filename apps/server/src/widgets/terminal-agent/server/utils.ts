import type { TerminalAgentProvider } from '../../../core/db/terminal-agent-repository'

export function toProvider(input: unknown, fallback: TerminalAgentProvider = 'codex'): TerminalAgentProvider {
  return input === 'gemini' ? 'gemini' : input === 'codex' ? 'codex' : fallback
}

export function toArgs(input: unknown) {
  if (!Array.isArray(input)) {
    return [] as string[]
  }

  return input
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
}

export function toSseEvent(event: string, payload: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

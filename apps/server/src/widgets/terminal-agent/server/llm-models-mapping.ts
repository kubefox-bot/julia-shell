import type { LlmCatalogError } from '../../../domains/llm-catalog/server'
import type { TerminalAgentProvider } from '../../../core/db/terminal-agent-repository'
import { WIDGET_ID } from './constants'
import type { TerminalAgentLlmModelsPayload } from './types'

type LlmCatalogValue = {
  provider: TerminalAgentProvider
  models: string[]
  source: 'db' | 'remote'
  updatedAt: string | null
  stale: boolean
}

export function toTerminalAgentLlmModelsPayload(input: LlmCatalogValue): TerminalAgentLlmModelsPayload {
  return {
    widgetId: WIDGET_ID,
    provider: input.provider,
    source: input.source,
    stale: input.stale,
    updatedAt: input.updatedAt,
    items: input.models.map((model) => ({
      value: model,
      label: model,
    })),
  }
}

export function toTerminalAgentLlmModelsHttpError(error: LlmCatalogError) {
  return {
    status: error.retryable ? 503 : 502,
    payload: {
      error: error.message,
      code: error.code,
    },
  }
}

import type { LlmCatalogError } from '../../../domains/llm/server'
import type { TerminalAgentProvider } from '../../../domains/llm/server/repository/terminal-agent-repository'
import { HTTP_STATUS_BAD_GATEWAY, HTTP_STATUS_SERVICE_UNAVAILABLE } from '@shared/lib/http-status'
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
    status: error.retryable ? HTTP_STATUS_SERVICE_UNAVAILABLE : HTTP_STATUS_BAD_GATEWAY,
    payload: {
      error: error.message,
      code: error.code,
    },
  }
}

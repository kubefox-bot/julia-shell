import { err, ok, type Result } from 'neverthrow'
import { z } from 'zod'
import {
  listLlmModels,
  replaceLlmModels,
  type LlmProvider,
} from '../../../core/db/llm-model-repository'

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24
const CONSUMER_TERMINAL_AGENT = 'terminal-agent'

const openAiModelsSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
  })),
})

const geminiModelsSchema = z.object({
  models: z.array(z.object({
    name: z.string(),
  })),
})

export type LlmCatalogError = {
  code: 'db_error' | 'provider_http_error' | 'provider_request_failed' | 'provider_payload_invalid'
  message: string
  retryable: boolean
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Result<Response, LlmCatalogError>> {
  let attempt = 0
  let lastError: LlmCatalogError = {
    code: 'provider_request_failed',
    message: 'Provider request failed.',
    retryable: true,
  }

  while (attempt <= retries) {
    try {
      const response = await fetch(url, init)
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        lastError = {
          code: 'provider_http_error',
          message: `Provider returned HTTP ${response.status}: ${body.slice(0, 240)}`,
          retryable: response.status >= 500 || response.status === 429,
        }
      } else {
        return ok(response)
      }
    } catch (error) {
      lastError = {
        code: 'provider_request_failed',
        message: error instanceof Error ? error.message : 'Provider request failed.',
        retryable: true,
      }
    }

    if (attempt >= retries || !lastError.retryable) {
      return err(lastError)
    }

    await sleep(200 * (attempt + 1))
    attempt += 1
  }

  return err(lastError)
}

async function fetchLlmModels(provider: LlmProvider, apiKey: string): Promise<Result<string[], LlmCatalogError>> {
  if (provider === 'codex') {
    const responseResult = await fetchWithRetry('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })
    if (responseResult.isErr()) {
      return err(responseResult.error)
    }

    const payload = await responseResult.value.json().catch(() => null)
    const parsed = openAiModelsSchema.safeParse(payload)
    if (!parsed.success) {
      return err({
        code: 'provider_payload_invalid',
        message: 'OpenAI models payload has invalid shape.',
        retryable: false,
      })
    }

    return ok(parsed.data.data
      .map((entry) => entry.id.trim())
      .filter((id) => id.startsWith('gpt-') || id.startsWith('o')))
  }

  const responseResult = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
  if (responseResult.isErr()) {
    return err(responseResult.error)
  }

  const payload = await responseResult.value.json().catch(() => null)
  const parsed = geminiModelsSchema.safeParse(payload)
  if (!parsed.success) {
    return err({
      code: 'provider_payload_invalid',
      message: 'Gemini models payload has invalid shape.',
      retryable: false,
    })
  }

  return ok(parsed.data.models
    .map((entry) => entry.name.trim().replace(/^models\//, ''))
    .filter(Boolean))
}

export async function getLlmModelCatalog(input: {
  provider: LlmProvider
  apiKey?: string
  forceRefresh?: boolean
}): Promise<Result<{
  provider: LlmProvider
  models: string[]
  source: 'db' | 'remote'
  updatedAt: string | null
  stale: boolean
  missingApiKey?: boolean
}, LlmCatalogError>> {
  const cachedRowsResult = listLlmModels(CONSUMER_TERMINAL_AGENT, input.provider)
  if (cachedRowsResult.isErr()) {
    return err({
      code: 'db_error',
      message: cachedRowsResult.error.message,
      retryable: true,
    })
  }

  const cachedRows = cachedRowsResult.value
  const cachedModels = cachedRows.map((row) => row.modelId)
  const cachedUpdatedAt = cachedRows[0]?.updatedAt ?? null
  const cachedIsFresh = Boolean(cachedUpdatedAt) && Date.now() - Date.parse(cachedUpdatedAt ?? '') < DEFAULT_TTL_MS

  if (!input.forceRefresh && cachedModels.length > 0 && cachedIsFresh) {
    return ok({
      provider: input.provider,
      models: cachedModels,
      source: 'db',
      updatedAt: cachedUpdatedAt,
      stale: false,
    })
  }

  const apiKey = input.apiKey?.trim() ?? ''
  if (!apiKey) {
    return ok({
      provider: input.provider,
      models: cachedModels,
      source: 'db',
      updatedAt: cachedUpdatedAt,
      stale: true,
      missingApiKey: true,
    })
  }

  const remoteModelsResult = await fetchLlmModels(input.provider, apiKey)
  if (remoteModelsResult.isOk() && remoteModelsResult.value.length > 0) {
    const persistedResult = replaceLlmModels({
      consumer: CONSUMER_TERMINAL_AGENT,
      provider: input.provider,
      modelIds: remoteModelsResult.value,
    })
    if (persistedResult.isErr()) {
      return err({
        code: 'db_error',
        message: persistedResult.error.message,
        retryable: true,
      })
    }

    return ok({
      provider: input.provider,
      models: remoteModelsResult.value,
      source: 'remote',
      updatedAt: persistedResult.value.updatedAt,
      stale: false,
    })
  }

  if (cachedModels.length > 0) {
    return ok({
      provider: input.provider,
      models: cachedModels,
      source: 'db',
      updatedAt: cachedUpdatedAt,
      stale: true,
    })
  }

  if (remoteModelsResult.isErr()) {
    return err(remoteModelsResult.error)
  }

  return ok({
    provider: input.provider,
    models: [],
    source: 'db',
    updatedAt: cachedUpdatedAt,
    stale: true,
  })
}

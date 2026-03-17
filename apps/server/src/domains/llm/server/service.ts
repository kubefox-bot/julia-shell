import { DateTime } from 'luxon'
import { Err, Ok, match, type Result } from 'oxide.ts'
import { z } from 'zod'
import { requestRaw } from '@shared/lib/request'
import {
  HTTP_STATUS_INTERNAL_SERVER_ERROR as HTTP_STATUS_SERVER_ERROR,
  HTTP_STATUS_TOO_MANY_REQUESTS
} from '@shared/lib/http/status'
import {
  listLlmModels,
  replaceLlmModels,
  type LlmProvider,
} from './repository/catalog-repository'

const DEFAULT_TTL_MS = Number('86400000')
const CONSUMER_TERMINAL_AGENT = 'terminal-agent'
const PROVIDER_ERROR_PREVIEW_LENGTH = 240
const RETRY_DELAY_MS = 200

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
      const response = await requestRaw(url, init)
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        lastError = {
          code: 'provider_http_error',
          message: `Provider returned HTTP ${response.status}: ${body.slice(0, PROVIDER_ERROR_PREVIEW_LENGTH)}`,
          retryable: response.status >= HTTP_STATUS_SERVER_ERROR || response.status === HTTP_STATUS_TOO_MANY_REQUESTS,
        }
      } else {
        return Ok(response)
      }
    } catch (error) {
      lastError = {
        code: 'provider_request_failed',
        message: error instanceof Error ? error.message : 'Provider request failed.',
        retryable: true,
      }
    }

    if (attempt >= retries || !lastError.retryable) {
      return Err(lastError)
    }

    await sleep(RETRY_DELAY_MS * (attempt + 1))
    attempt += 1
  }

  return Err(lastError)
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
      return Err(responseResult.unwrapErr())
    }

    const payload = await responseResult.unwrap().json().catch(() => null)
    const parsed = openAiModelsSchema.safeParse(payload)
    if (!parsed.success) {
      return Err({
        code: 'provider_payload_invalid',
        message: 'OpenAI models payload has invalid shape.',
        retryable: false,
      })
    }

    return Ok(parsed.data.data
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
    return Err(responseResult.unwrapErr())
  }

  const payload = await responseResult.unwrap().json().catch(() => null)
  const parsed = geminiModelsSchema.safeParse(payload)
  if (!parsed.success) {
    return Err({
      code: 'provider_payload_invalid',
      message: 'Gemini models payload has invalid shape.',
      retryable: false,
    })
  }

  return Ok(parsed.data.models
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
  return match(cachedRowsResult, {
    Err: async (error) => Err({
      code: 'db_error',
      message: error.message,
      retryable: true,
    }),
    Ok: async (cachedRows) => {
      const cachedModels = cachedRows.map((row) => row.modelId)
      const cachedUpdatedAt = cachedRows[0]?.updatedAt ?? null
      const cachedUpdatedAtMs = cachedUpdatedAt ? DateTime.fromISO(cachedUpdatedAt).toMillis() : Number.NaN
      const cachedIsFresh = Boolean(cachedUpdatedAt) && Number.isFinite(cachedUpdatedAtMs) && DateTime.now().toMillis() - cachedUpdatedAtMs < DEFAULT_TTL_MS

      if (!input.forceRefresh && cachedModels.length > 0 && cachedIsFresh) {
        return Ok({
          provider: input.provider,
          models: cachedModels,
          source: 'db',
          updatedAt: cachedUpdatedAt,
          stale: false,
        })
      }

      const apiKey = input.apiKey?.trim() ?? ''
      if (!apiKey) {
        return Ok({
          provider: input.provider,
          models: cachedModels,
          source: 'db',
          updatedAt: cachedUpdatedAt,
          stale: true,
          missingApiKey: true,
        })
      }

      const remoteModelsResult = await fetchLlmModels(input.provider, apiKey)
      const [remoteError, remoteModels] = remoteModelsResult.intoTuple()
      if (remoteError) {
        if (cachedModels.length > 0) {
          return Ok({
            provider: input.provider,
            models: cachedModels,
            source: 'db',
            updatedAt: cachedUpdatedAt,
            stale: true,
          })
        }

        return Err(remoteError)
      }

      if (remoteModels && remoteModels.length > 0) {
        const persistedResult = replaceLlmModels({
          consumer: CONSUMER_TERMINAL_AGENT,
          provider: input.provider,
          modelIds: remoteModels,
        })
        const [persistedError, persisted] = persistedResult.intoTuple()
        if (persistedError) {
          return Err({
            code: 'db_error',
            message: persistedError.message,
            retryable: true,
          })
        }

        return Ok({
          provider: input.provider,
          models: remoteModels,
          source: 'remote',
          updatedAt: persisted.updatedAt,
          stale: false,
        })
      }

      if (cachedModels.length > 0) {
        return Ok({
          provider: input.provider,
          models: cachedModels,
          source: 'db',
          updatedAt: cachedUpdatedAt,
          stale: true,
        })
      }

      return Ok({
        provider: input.provider,
        models: [],
        source: 'db',
        updatedAt: cachedUpdatedAt,
        stale: true,
      })
    }
  })
}

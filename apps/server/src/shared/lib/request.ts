import ky, { type Input, type Options } from 'ky'
import { fromThrowablePromise } from './result'
import { buildRequestHeaders, type WidgetRequestMeta } from './request-headers'

const DEFAULT_RETRY_LIMIT = 0
const DEFAULT_REQUEST_BASE_URL = 'http://localhost'

export type RequestOptions = Omit<Options, 'headers'> & {
  headers?: HeadersInit
  widget?: WidgetRequestMeta
}

export type QueryDefinition<TQueryKey extends readonly unknown[], TData> = {
  queryKey: TQueryKey
  queryFn: () => Promise<TData>
}

function withRequestOptions(options?: RequestOptions): Options {
  return {
    ...options,
    retry: options?.retry ?? DEFAULT_RETRY_LIMIT,
    throwHttpErrors: false,
    headers: buildRequestHeaders(options?.headers, { widget: options?.widget }),
  }
}

function resolveRequestInput(input: Input): Input {
  if (typeof input !== 'string' || !input.startsWith('/')) {
    return input
  }

  const browserOrigin = globalThis.location?.origin
  const baseUrl = browserOrigin || DEFAULT_REQUEST_BASE_URL
  return new URL(input, baseUrl).toString()
}

export function requestRaw(input: Input, options?: RequestOptions) {
  return ky(resolveRequestInput(input), withRequestOptions(options))
}

async function resolveErrorMessage(response: Response, fallbackMessage?: string) {
  const responseText = await response.text().catch(() => '')
  if (responseText) {
    try {
      const payload = JSON.parse(responseText) as { error?: string; message?: string }
      const payloadMessage = payload.error ?? payload.message
      if (typeof payloadMessage === 'string' && payloadMessage.trim()) {
        return payloadMessage
      }
    } catch {
      // keep plain-text fallback below
    }

    if (responseText.trim()) {
      return responseText.trim()
    }
  }

  return fallbackMessage ?? `Request failed with ${response.status}`
}

export async function requestJson<T>(input: Input, options?: RequestOptions, fallbackMessage?: string) {
  const response = await requestRaw(input, options)
  if (!response.ok) {
    throw new Error(await resolveErrorMessage(response, fallbackMessage))
  }

  return response.json<T>()
}

export function requestJsonResult<T>(input: Input, options?: RequestOptions, fallbackMessage?: string) {
  return fromThrowablePromise(requestJson<T>(input, options, fallbackMessage))
}

export async function requestBody(input: Input, options?: RequestOptions, fallbackMessage?: string) {
  const response = await requestRaw(input, options)
  if (!response.ok || !response.body) {
    throw new Error(await resolveErrorMessage(response, fallbackMessage))
  }

  return response.body
}

export function requestBodyResult(input: Input, options?: RequestOptions, fallbackMessage?: string) {
  return fromThrowablePromise(requestBody(input, options, fallbackMessage))
}

export function defineQuery<TQueryKey extends readonly unknown[], TData>(
  queryKey: TQueryKey,
  queryFn: () => Promise<TData>
): QueryDefinition<TQueryKey, TData> {
  return { queryKey, queryFn }
}

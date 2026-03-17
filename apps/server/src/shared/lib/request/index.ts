import ky, { type Input, type Options } from 'ky'
import { Err, Ok, Result, match, type Result as OxideResult } from 'oxide.ts'
import { buildRequestHeaders, type WidgetRequestMeta } from './headers'

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
    const parsedResult = Result.safe(() => JSON.parse(responseText) as { error?: string; message?: string })
    const payloadMessage = match(parsedResult, {
      Ok: (payload) => payload.error ?? payload.message,
      Err: () => null
    })
    if (typeof payloadMessage === 'string' && payloadMessage.trim()) {
      return payloadMessage
    }

    if (responseText.trim()) {
      return responseText.trim()
    }
  }

  return fallbackMessage ?? `Request failed with ${response.status}`
}

export async function requestJson<T>(input: Input, options?: RequestOptions, fallbackMessage?: string) {
  const result = await requestJsonResult<T>(input, options, fallbackMessage)
  const [error, value] = result.intoTuple()
  if (error) {
    throw error
  }

  return value
}

export async function requestJsonResult<T>(
  input: Input,
  options?: RequestOptions,
  fallbackMessage?: string
): Promise<OxideResult<T, Error>> {
  const response = await requestRaw(input, options)
  if (!response.ok) {
    return Err(new Error(await resolveErrorMessage(response, fallbackMessage)))
  }

  const parsedResult = await Result.safe(response.json<T>())
  return parsedResult.mapErr((error) => (error instanceof Error ? error : new Error('Failed to parse response json.')))
}

export async function requestBody(input: Input, options?: RequestOptions, fallbackMessage?: string) {
  const result = await requestBodyResult(input, options, fallbackMessage)
  const [error, value] = result.intoTuple()
  if (error) {
    throw error
  }

  return value
}

export async function requestBodyResult(
  input: Input,
  options?: RequestOptions,
  fallbackMessage?: string
): Promise<OxideResult<ReadableStream<Uint8Array>, Error>> {
  const response = await requestRaw(input, options)
  if (!response.ok || !response.body) {
    return Err(new Error(await resolveErrorMessage(response, fallbackMessage)))
  }

  return Ok(response.body)
}

export function defineQuery<TQueryKey extends readonly unknown[], TData>(
  queryKey: TQueryKey,
  queryFn: () => Promise<TData>
): QueryDefinition<TQueryKey, TData> {
  return { queryKey, queryFn }
}

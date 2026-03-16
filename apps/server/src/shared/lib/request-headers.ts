import { nowMillis } from './time'

const REQUEST_ID_HEADER = 'x-request-id'
const WIDGET_ID_HEADER = 'x-widget-id'
const WIDGET_VERSION_HEADER = 'x-widget-version'
const HEX_RADIX = 16
const RANDOM_PREFIX_LENGTH = 2

export type WidgetRequestMeta = {
  id: string
  version: string
}

function createRequestId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  const timestamp = nowMillis().toString(HEX_RADIX)
  const randomPart = Math.random().toString(HEX_RADIX).slice(RANDOM_PREFIX_LENGTH)
  return `${timestamp}-${randomPart}`
}

export function buildRequestHeaders(
  inputHeaders?: HeadersInit,
  options?: { widget?: WidgetRequestMeta }
) {
  const headers = new Headers(inputHeaders)
  if (!headers.has(REQUEST_ID_HEADER)) {
    headers.set(REQUEST_ID_HEADER, createRequestId())
  }

  if (options?.widget) {
    headers.set(WIDGET_ID_HEADER, options.widget.id)
    headers.set(WIDGET_VERSION_HEADER, options.widget.version)
  }

  return headers
}

export function withRequestHeaders(init?: RequestInit, options?: { widget?: WidgetRequestMeta }): RequestInit {
  return {
    ...init,
    headers: buildRequestHeaders(init?.headers, options),
  }
}

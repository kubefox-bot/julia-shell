const REQUEST_ID_HEADER = 'x-request-id'
const WIDGET_ID_HEADER = 'x-widget-id'
const WIDGET_VERSION_HEADER = 'x-widget-version'

export type WidgetRequestMeta = {
  id: string
  version: string
}

function createRequestId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  const timestamp = Date.now().toString(16)
  const randomPart = Math.random().toString(16).slice(2)
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

export function fetchWithRequestHeaders(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { widget?: WidgetRequestMeta }
) {
  return fetch(input, withRequestHeaders(init, options))
}

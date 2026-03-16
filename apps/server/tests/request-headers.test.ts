import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchShellSettings } from '../src/app/shell/lib/api'
import { buildRequestHeaders } from '../src/shared/lib/request-headers'
import { fetchTranscribeSettings } from '../src/widgets/transcribe/ui/lib/transcribe-api'
import { buildWidgetApiRoute, TRANSCRIBE_WIDGET_ID } from '@/widgets'

function toRequest(input: RequestInfo | URL) {
  return input instanceof Request ? input : new Request(String(input))
}

describe('request headers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('adds x-request-id and preserves existing headers', () => {
    const headers = buildRequestHeaders({ 'Content-Type': 'application/json' })

    expect(headers.get('x-request-id')).toBeTruthy()
    expect(headers.get('content-type')).toBe('application/json')
  })

  it('uses existing x-request-id when provided', () => {
    const headers = buildRequestHeaders({ 'x-request-id': 'fixed-id' })
    expect(headers.get('x-request-id')).toBe('fixed-id')
  })

  it('adds widget headers for transcribe widget requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          widgetId: TRANSCRIBE_WIDGET_ID,
          envName: 'GEMINI_API_KEY',
          geminiModel: 'gemini-2.5-flash',
          availableModels: ['gemini-2.5-flash'],
          apiKeySource: 'missing',
          apiKeyEditable: true,
          apiKeyValue: '',
          hasApiKey: false,
          secretName: 'GEMINI_API_KEY',
          secretPath: '/transcribe',
          recentFolders: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchTranscribeSettings()

    const [url] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined]
    const request = toRequest(url)
    expect(request.url).toContain(buildWidgetApiRoute(TRANSCRIBE_WIDGET_ID, 'settings'))
    expect(request.headers.get('x-request-id')).toBeTruthy()
    expect(request.headers.get('x-widget-id')).toBe(TRANSCRIBE_WIDGET_ID)
    expect(request.headers.get('x-widget-version')).toBe('1.0.0')
  })

  it('adds x-request-id without widget headers for shell API requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          layoutSettings: { desktopColumns: 12, mobileColumns: 1, locale: 'ru', theme: 'auto' },
          layout: [],
          modules: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchShellSettings()

    const [url] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined]
    const request = toRequest(url)
    expect(request.url).toContain('/api/shell/settings')
    expect(request.headers.get('x-request-id')).toBeTruthy()
    expect(request.headers.has('x-widget-id')).toBe(false)
    expect(request.headers.has('x-widget-version')).toBe(false)
  })
})

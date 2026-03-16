import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, vi } from 'vitest'
import { resetDbCache } from '../src/core/db/shared'
import type { WidgetRouteContext } from '../src/entities/widget/model/types'
import { WIDGET_ID } from '../src/widgets/terminal-agent/server/constants'

const DATA_PREFIX_LENGTH = 5
const EVENT_PREFIX_LENGTH = 6

export const HTTP_STATUS_BAD_REQUEST = 400
export const HTTP_STATUS_OK = 200
export const HTTP_STATUS_SERVICE_UNAVAILABLE = 503

export type SseEvent = {
  event: string
  payload: Record<string, unknown>
}

let tempDir = ''
const RUNTIME_CONNECTED_AT = '2026-03-09T10:00:00.000Z'
const RUNTIME_LAST_HEARTBEAT_AT = '2026-03-09T10:01:00.000Z'

export function setupTerminalAgentTestFs() {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-terminal-agent-server-'))
    process.env.JULIAAPP_DATA_DIR = tempDir
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetDbCache()
    fs.rmSync(tempDir, { recursive: true, force: true })
    delete process.env.JULIAAPP_DATA_DIR
  })
}

export function createOnlineAgentSession(agentId = 'runtime-agent') {
  return {
    agentId,
    sessionId: 'runtime-session',
    connectedAt: RUNTIME_CONNECTED_AT,
    lastHeartbeatAt: RUNTIME_LAST_HEARTBEAT_AT,
    hostname: 'host',
    accessJwt: 'token',
  }
}

export function createContext(input: {
  url: string
  action: string
  actionSegments?: string[]
  method?: string
  body?: Record<string, unknown>
  agentId?: string
}): WidgetRouteContext {
  const requestInit: RequestInit = { method: input.method ?? 'GET' }
  if (input.body) {
    requestInit.headers = { 'Content-Type': 'application/json' }
    requestInit.body = JSON.stringify(input.body)
  }

  return {
    request: new Request(input.url, requestInit),
    agentId: input.agentId ?? 'agent-a',
    action: input.action,
    actionSegments: input.actionSegments ?? [input.action],
    params: { id: WIDGET_ID },
  }
}

function parseSseChunk(rawChunk: string): SseEvent | null {
  const lines = rawChunk.split('\n')
  let eventName = 'message'
  const dataLines: string[] = []

  for (const lineRaw of lines) {
    const line = lineRaw.trimEnd()
    if (line.startsWith('event:')) {
      eventName = line.slice(EVENT_PREFIX_LENGTH).trim()
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(DATA_PREFIX_LENGTH).trimStart())
    }
  }

  if (dataLines.length === 0) {
    return null
  }

  try {
    return {
      event: eventName,
      payload: JSON.parse(dataLines.join('\n')) as Record<string, unknown>,
    }
  } catch {
    return null
  }
}

async function collectSseEvents(response: Response) {
  if (!response.body) {
    throw new Error('SSE response body is missing.')
  }

  const events: SseEvent[] = []
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      return events
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
    while (true) {
      const boundary = buffer.indexOf('\n\n')
      if (boundary === -1) {
        break
      }

      const chunk = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      const parsed = parseSseChunk(chunk)
      if (parsed) {
        events.push(parsed)
      }
    }
  }
}

export async function collectSseEventsWithTimeout(response: Response, timeoutMs = 1500) {
  let timer: NodeJS.Timeout | null = null

  try {
    return await Promise.race([
      collectSseEvents(response),
      new Promise<SseEvent[]>((_, reject) => {
        timer = setTimeout(() => reject(new Error('SSE stream timeout in test.')), timeoutMs)
      }),
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

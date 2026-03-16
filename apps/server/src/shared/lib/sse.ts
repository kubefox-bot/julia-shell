type ParsedSsePayload = Record<string, unknown>

const SSE_EVENT_PREFIX = 'event:'
const SSE_DATA_PREFIX = 'data:'

export type ParsedSseChunk<TPayload extends ParsedSsePayload = ParsedSsePayload> = {
  eventName: string
  payload: TPayload
}

export function parseSseEventChunk<TPayload extends ParsedSsePayload = ParsedSsePayload>(
  rawEvent: string
): ParsedSseChunk<TPayload> | null {
  const lines = rawEvent.split('\n')
  let eventName = 'message'
  const dataLines: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (line.startsWith(SSE_EVENT_PREFIX)) {
      eventName = line.slice(SSE_EVENT_PREFIX.length).trim()
    } else if (line.startsWith(SSE_DATA_PREFIX)) {
      dataLines.push(line.slice(SSE_DATA_PREFIX.length).trimStart())
    }
  }

  if (dataLines.length === 0) {
    return null
  }

  try {
    const payload = JSON.parse(dataLines.join('\n')) as TPayload
    return { eventName, payload }
  } catch {
    return null
  }
}


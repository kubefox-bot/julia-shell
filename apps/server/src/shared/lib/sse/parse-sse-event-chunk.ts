import { Err, Ok, Result, type Result as OxideResult } from 'oxide.ts'

type ParsedSsePayload = Record<string, unknown>

const SSE_EVENT_PREFIX = 'event:'
const SSE_DATA_PREFIX = 'data:'

export type ParsedSseChunk<TPayload extends ParsedSsePayload = ParsedSsePayload> = {
  eventName: string
  payload: TPayload
}

export type ParseSseChunkError =
  | { code: 'empty_data' }
  | { code: 'invalid_json'; message: string }

export function parseSseEventChunk<TPayload extends ParsedSsePayload = ParsedSsePayload>(
  rawEvent: string
): OxideResult<ParsedSseChunk<TPayload>, ParseSseChunkError> {
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
    return Err({ code: 'empty_data' })
  }

  const parseResult = Result.safe(() => JSON.parse(dataLines.join('\n')))
    .map((payload) => payload as TPayload)
    .mapErr((error) => ({
      code: 'invalid_json' as const,
      message: error.message
    }))

  if (parseResult.isErr()) {
    return Err(parseResult.unwrapErr())
  }

  return Ok({
    eventName,
    payload: parseResult.unwrap()
  })
}

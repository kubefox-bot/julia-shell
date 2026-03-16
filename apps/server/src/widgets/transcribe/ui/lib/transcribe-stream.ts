import { parseSseEventChunk } from '../helpers'
import type { ConsumeTranscribeStreamHandlers } from './types'

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function splitChunks(buffer: string) {
  const chunks: string[] = []
  let cursor = buffer

  while (true) {
    const boundary = cursor.indexOf('\n\n')
    if (boundary === -1) {
      return { chunks, rest: cursor }
    }
    chunks.push(cursor.slice(0, boundary))
    cursor = cursor.slice(boundary + 2)
  }
}

async function handleChunk(
  chunk: string,
  handlers: ConsumeTranscribeStreamHandlers
): Promise<{ done: boolean }> {
  const parsedResult = parseSseEventChunk(chunk)
  if (parsedResult.isErr()) {
    return { done: false }
  }
  const parsed = parsedResult.unwrap()

  switch (parsed.eventName) {
    case 'progress':
      await handlers.onProgress(toNumber(parsed.payload.percent), toText(parsed.payload.stage))
      return { done: false }
    case 'token':
      await handlers.onToken(toText(parsed.payload.text))
      return { done: false }
    case 'done':
      await handlers.onDone({
        transcript: toText(parsed.payload.transcript),
        savePath: toText(parsed.payload.savePath)
      })
      return { done: true }
    case 'error':
      throw new Error(toText(parsed.payload.message) || 'Transcription error.')
    default:
      return { done: false }
  }
}

export async function consumeTranscribeStream(
  stream: ReadableStream<Uint8Array>,
  handlers: ConsumeTranscribeStreamHandlers
) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false

  while (!finished) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
    const { chunks, rest } = splitChunks(buffer)
    buffer = rest

    for (const chunk of chunks) {
      const result = await handleChunk(chunk, handlers)
      if (result.done) {
        finished = true
        break
      }
    }
  }

  if (!finished) {
    throw new Error('Stream finished without a result.')
  }
}

import { parseSseEventChunk } from '../helpers'
import type { ConsumeTranscribeStreamHandlers } from './types'

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export async function consumeTranscribeStream(
  stream: ReadableStream<Uint8Array>,
  handlers: ConsumeTranscribeStreamHandlers
) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')

    while (true) {
      const boundary = buffer.indexOf('\n\n')
      if (boundary === -1) {
        break
      }

      const chunk = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      const parsed = parseSseEventChunk(chunk)
      if (!parsed) {
        continue
      }

      if (parsed.eventName === 'progress') {
        await handlers.onProgress(toNumber(parsed.payload.percent), toString(parsed.payload.stage))
        continue
      }

      if (parsed.eventName === 'token') {
        await handlers.onToken(toString(parsed.payload.text))
        continue
      }

      if (parsed.eventName === 'done') {
        finished = true
        await handlers.onDone({
          transcript: toString(parsed.payload.transcript),
          savePath: toString(parsed.payload.savePath)
        })
        continue
      }

      if (parsed.eventName === 'error') {
        throw new Error(toString(parsed.payload.message) || 'Transcription error.')
      }
    }
  }

  if (!finished) {
    throw new Error('Stream finished without a result.')
  }
}

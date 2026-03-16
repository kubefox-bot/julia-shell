import { useCallback, useEffect, useRef } from 'react'
import type { UseTypewriterRevealOptions } from './types'

const LARGE_BATCH_THRESHOLD = 220
const MEDIUM_BATCH_THRESHOLD = 120
const SMALL_BATCH_THRESHOLD = 40
const LARGE_BATCH_SIZE = 14
const MEDIUM_BATCH_SIZE = 10
const SMALL_BATCH_SIZE = 6
const MIN_BATCH_SIZE = 3
const TYPEWRITER_DELAY_MS = 22

function getBatchSize(remaining: number) {
  if (remaining > LARGE_BATCH_THRESHOLD) {
    return LARGE_BATCH_SIZE
  }
  if (remaining > MEDIUM_BATCH_THRESHOLD) {
    return MEDIUM_BATCH_SIZE
  }
  if (remaining > SMALL_BATCH_THRESHOLD) {
    return SMALL_BATCH_SIZE
  }
  return MIN_BATCH_SIZE
}

export function useTypewriterReveal(options: UseTypewriterRevealOptions) {
  const queueRef = useRef('')
  const timerRef = useRef<number | null>(null)
  const onChunkRef = useRef(options.onChunk)
  const onCompleteRef = useRef(options.onComplete)

  useEffect(() => {
    onChunkRef.current = options.onChunk
    onCompleteRef.current = options.onComplete
  }, [options.onChunk, options.onComplete])

  const run = useCallback(() => {
    if (!queueRef.current.length) {
      timerRef.current = null
      onCompleteRef.current()
      return
    }

    const batchSize = getBatchSize(queueRef.current.length)
    const chunk = queueRef.current.slice(0, batchSize)
    queueRef.current = queueRef.current.slice(batchSize)
    onChunkRef.current(chunk)
    timerRef.current = window.setTimeout(run, TYPEWRITER_DELAY_MS)
  }, [])

  const ensureRunning = useCallback(() => {
    if (timerRef.current !== null) {
      return
    }
    timerRef.current = window.setTimeout(run, TYPEWRITER_DELAY_MS)
  }, [run])

  const enqueue = useCallback((text: string) => {
    if (!text) {
      return
    }
    queueRef.current += text
    ensureRunning()
  }, [ensureRunning])

  const clearQueue = useCallback(() => {
    queueRef.current = ''
  }, [])

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    queueRef.current = ''
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  return {
    enqueue,
    stop,
    clearQueue
  }
}

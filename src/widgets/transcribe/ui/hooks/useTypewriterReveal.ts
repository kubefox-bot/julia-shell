import { useCallback, useEffect, useRef } from 'react'
import type { UseTypewriterRevealOptions } from './types'

function getBatchSize(remaining: number) {
  if (remaining > 220) {
    return 14
  }
  if (remaining > 120) {
    return 10
  }
  if (remaining > 40) {
    return 6
  }
  return 3
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
    timerRef.current = window.setTimeout(run, 22)
  }, [])

  const ensureRunning = useCallback(() => {
    if (timerRef.current !== null) {
      return
    }
    timerRef.current = window.setTimeout(run, 22)
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

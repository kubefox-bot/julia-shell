import { useEffect, useRef, useState } from 'react'
import type { MessageItem, Provider } from '../terminal-agent.types'
import { getMessagesStorageKey } from '../terminal-agent.utils'

type Input = {
  activeProvider: Provider
  sessionRef: string
  enabled: boolean
}

export function useTerminalAgentStorage(input: Input) {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const hydratedMessagesKeyRef = useRef('')
  const previousMessagesKeyRef = useRef('')
  const messagesRef = useRef<MessageItem[]>([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (!input.enabled) {
      return
    }

    const storageKey = getMessagesStorageKey(input.activeProvider, input.sessionRef)
    hydratedMessagesKeyRef.current = storageKey
    const previousKey = previousMessagesKeyRef.current
    previousMessagesKeyRef.current = storageKey

    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) {
        const wasDraft = previousKey.endsWith(':__current')
        const isRealSession = !storageKey.endsWith(':__current')
        if (wasDraft && isRealSession && messagesRef.current.length > 0) {
          localStorage.setItem(storageKey, JSON.stringify(messagesRef.current))
          return
        }
        setMessages([])
        return
      }

      const parsed = JSON.parse(raw) as MessageItem[]
      setMessages(Array.isArray(parsed) ? parsed : [])
    } catch {
      setMessages([])
    }
  }, [input.activeProvider, input.enabled, input.sessionRef])

  useEffect(() => {
    const storageKey = hydratedMessagesKeyRef.current
    if (!storageKey) {
      return
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch {
      // ignore local persistence failures
    }
  }, [messages])

  return { messages, setMessages }
}

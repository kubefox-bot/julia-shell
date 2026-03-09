import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WidgetRenderProps } from '../../../entities/widget/model/types'
import { Button } from '../../../shared/ui/Button'
import { OptionSelect } from '../../../shared/ui/OptionSelect'
import styles from './TerminalAgentWidget.module.scss'

type Provider = 'codex' | 'gemini'

type SettingsPayload = {
  widgetId: string
  activeProvider: Provider
  providers: Array<{ value: Provider; label: string }>
  codexApiKey: string
  geminiApiKey: string
  codexCommand: string
  codexArgs: string[]
  geminiCommand: string
  geminiArgs: string[]
  useShellFallback: boolean
  shellOverride: string
}

type DialogStatePayload = {
  provider: Provider
  providerSessionRef: string
  status: string
  lastError: string | null
}

type MessageItem = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

type ParsedSseChunk = {
  eventName: string
  payload: Record<string, unknown>
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function parseSseEventChunk(rawEvent: string): ParsedSseChunk | null {
  const lines = rawEvent.split('\n')
  let eventName = 'message'
  const dataLines: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) {
    return null
  }

  try {
    const payload = JSON.parse(dataLines.join('\n')) as Record<string, unknown>
    return { eventName, payload }
  } catch {
    return null
  }
}

function parseArgsInput(value: string) {
  return value
    .split(' ')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const dictionary = {
  ru: {
    placeholder: 'Напиши сообщение...',
    send: 'Отправить',
    sending: 'Думаю...',
    settings: 'Настройки',
    save: 'Сохранить',
    close: 'Закрыть',
    newDialog: 'Новый диалог',
    provider: 'Провайдер',
    codexKey: 'Codex API key',
    geminiKey: 'Gemini API key',
    codexCommand: 'Codex command path',
    codexArgs: 'Codex args (через пробел)',
    geminiCommand: 'Gemini command path',
    geminiArgs: 'Gemini args (через пробел)',
    shellFallback: 'Разрешить shell fallback',
    shellOverride: 'Shell override',
    resumeRef: 'Continuity ref',
    status: 'Статус',
    resumeFailed: 'Не удалось восстановить continuity. Нажми "Новый диалог".',
  },
  en: {
    placeholder: 'Type your message...',
    send: 'Send',
    sending: 'Thinking...',
    settings: 'Settings',
    save: 'Save',
    close: 'Close',
    newDialog: 'New dialog',
    provider: 'Provider',
    codexKey: 'Codex API key',
    geminiKey: 'Gemini API key',
    codexCommand: 'Codex command path',
    codexArgs: 'Codex args (space separated)',
    geminiCommand: 'Gemini command path',
    geminiArgs: 'Gemini args (space separated)',
    shellFallback: 'Allow shell fallback',
    shellOverride: 'Shell override',
    resumeRef: 'Continuity ref',
    status: 'Status',
    resumeFailed: 'Continuity restore failed. Start a new dialog.',
  },
} as const

export function TerminalAgentWidget(props: WidgetRenderProps) {
  const t = dictionary[props.locale]
  const [settings, setSettings] = useState<SettingsPayload | null>(null)
  const [dialogState, setDialogState] = useState<DialogStatePayload | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [input, setInput] = useState('')
  const [statusLine, setStatusLine] = useState('idle')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [resumeFailed, setResumeFailed] = useState(false)

  const themeClass = props.theme === 'night' ? styles.night : styles.day

  const activeProvider: Provider = settings?.activeProvider ?? 'codex'

  const loadSettings = useCallback(async () => {
    const response = await fetch('/api/widget/com.yulia.terminal-agent/settings')
    const data = await response.json() as SettingsPayload
    if (!response.ok) {
      throw new Error(toText((data as Record<string, unknown>).error) || 'Failed to load settings.')
    }

    setSettings(data)
  }, [])

  const loadDialogState = useCallback(async (provider: Provider) => {
    const response = await fetch(`/api/widget/com.yulia.terminal-agent/dialog-state?provider=${encodeURIComponent(provider)}`)
    const data = await response.json() as DialogStatePayload
    if (!response.ok) {
      throw new Error(toText((data as Record<string, unknown>).error) || 'Failed to load dialog state.')
    }

    setDialogState(data)
    setStatusLine(data.status || 'idle')
    setError(data.lastError)
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        await loadSettings()
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load widget.')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [loadSettings])

  useEffect(() => {
    if (!settings) {
      return
    }

    void loadDialogState(settings.activeProvider)
  }, [loadDialogState, settings])

  const providerOptions = useMemo(
    () => (settings?.providers ?? []).map((entry) => ({ value: entry.value, label: entry.label })),
    [settings?.providers]
  )

  const saveSettings = useCallback(async () => {
    if (!settings) {
      return
    }

    setError(null)

    const response = await fetch('/api/widget/com.yulia.terminal-agent/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    const data = await response.json() as SettingsPayload
    if (!response.ok) {
      throw new Error(toText((data as Record<string, unknown>).error) || 'Failed to save settings.')
    }

    setSettings(data)
    setSettingsOpen(false)
  }, [settings])

  const createNewDialog = useCallback(async () => {
    setError(null)
    setResumeFailed(false)

    const response = await fetch('/api/widget/com.yulia.terminal-agent/dialog/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: activeProvider }),
    })

    const data = await response.json() as DialogStatePayload
    if (!response.ok) {
      throw new Error(toText((data as Record<string, unknown>).error) || 'Failed to reset dialog.')
    }

    setDialogState(data)
    setMessages([])
    setStatusLine('idle')
  }, [activeProvider])

  const sendMessage = useCallback(async () => {
    const message = input.trim()
    if (!message || !settings || sending) {
      return
    }

    setSending(true)
    setError(null)
    setResumeFailed(false)
    setInput('')

    const userMessageId = `${Date.now()}-user`
    const assistantMessageId = `${Date.now()}-assistant`

    setMessages((prev) => [...prev, { id: userMessageId, role: 'user', text: message }, { id: assistantMessageId, role: 'assistant', text: '' }])

    try {
      const response = await fetch('/api/widget/com.yulia.terminal-agent/message-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: settings.activeProvider, message }),
      })

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null) as Record<string, unknown> | null
        throw new Error(toText(payload?.error) || 'Message stream failed.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

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

          if (parsed.eventName === 'status') {
            setStatusLine(toText(parsed.payload.status) || 'running')
            continue
          }

          if (parsed.eventName === 'assistant_chunk') {
            const text = toText(parsed.payload.text)
            if (!text) {
              continue
            }

            setMessages((prev) => prev.map((entry) => entry.id === assistantMessageId ? { ...entry, text: entry.text + text } : entry))
            continue
          }

          if (parsed.eventName === 'assistant_done') {
            const providerRef = toText(parsed.payload.providerRef)
            setDialogState((prev) => prev ? {
              ...prev,
              providerSessionRef: providerRef || prev.providerSessionRef,
              status: 'done',
              lastError: null,
            } : prev)
            setStatusLine('done')
            continue
          }

          if (parsed.eventName === 'resume_failed') {
            const reason = toText(parsed.payload.reason) || 'resume_failed'
            setResumeFailed(true)
            setError(reason)
            setStatusLine('error')
            continue
          }

          if (parsed.eventName === 'error') {
            throw new Error(toText(parsed.payload.message) || 'Agent error.')
          }
        }
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Message failed.')
      setStatusLine('error')
    } finally {
      setSending(false)
    }
  }, [input, sending, settings])

  return (
    <div className={[styles.root, themeClass].join(' ')}>
      <div className={styles.toolbar}>
        <div className={styles.meta}>
          <strong>{activeProvider === 'codex' ? 'Codex' : 'Gemini CLI'}</strong>
          <span>{t.status}: {statusLine}</span>
          <span>{t.resumeRef}: {dialogState?.providerSessionRef || '—'}</span>
        </div>
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={() => setSettingsOpen(true)}>{t.settings}</Button>
          <Button type="button" variant="ghost" onClick={() => void createNewDialog()}>{t.newDialog}</Button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {resumeFailed ? <p className={styles.warning}>{t.resumeFailed}</p> : null}

      <div className={styles.chatList}>
        {messages.map((entry) => (
          <article key={entry.id} className={[styles.bubble, entry.role === 'user' ? styles.user : styles.assistant].join(' ')}>
            {entry.text || (entry.role === 'assistant' && sending ? '…' : '')}
          </article>
        ))}
      </div>

      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault()
          void sendMessage()
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t.placeholder}
          rows={3}
          disabled={sending}
        />
        <Button type="submit" disabled={sending || !input.trim()}>
          {sending ? t.sending : t.send}
        </Button>
      </form>

      {settingsOpen && settings ? (
        <div className={styles.settingsOverlay} role="dialog" aria-modal="true">
          <div className={styles.settingsPanel}>
            <div className={styles.field}>
              {t.provider}
              <OptionSelect
                theme={props.theme}
                value={settings.activeProvider}
                options={providerOptions}
                onChange={(value) => {
                  const next = value === 'gemini' ? 'gemini' : 'codex'
                  setSettings((prev) => prev ? { ...prev, activeProvider: next } : prev)
                  void loadDialogState(next)
                }}
              />
            </div>

            <label>
              {t.codexKey}
              <input
                value={settings.codexApiKey}
                onChange={(event) => setSettings((prev) => prev ? { ...prev, codexApiKey: event.target.value } : prev)}
              />
            </label>
            <label>
              {t.geminiKey}
              <input
                value={settings.geminiApiKey}
                onChange={(event) => setSettings((prev) => prev ? { ...prev, geminiApiKey: event.target.value } : prev)}
              />
            </label>
            <label>
              {t.codexCommand}
              <input
                value={settings.codexCommand}
                onChange={(event) => setSettings((prev) => prev ? { ...prev, codexCommand: event.target.value } : prev)}
              />
            </label>
            <label>
              {t.codexArgs}
              <input
                value={settings.codexArgs.join(' ')}
                onChange={(event) => setSettings((prev) => prev ? { ...prev, codexArgs: parseArgsInput(event.target.value) } : prev)}
              />
            </label>
            <label>
              {t.geminiCommand}
              <input
                value={settings.geminiCommand}
                onChange={(event) => setSettings((prev) => prev ? { ...prev, geminiCommand: event.target.value } : prev)}
              />
            </label>
            <label>
              {t.geminiArgs}
              <input
                value={settings.geminiArgs.join(' ')}
                onChange={(event) => setSettings((prev) => prev ? { ...prev, geminiArgs: parseArgsInput(event.target.value) } : prev)}
              />
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={settings.useShellFallback}
                onChange={(event) => setSettings((prev) => prev ? { ...prev, useShellFallback: event.target.checked } : prev)}
              />
              <span>{t.shellFallback}</span>
            </label>
            <label>
              {t.shellOverride}
              <input
                value={settings.shellOverride}
                onChange={(event) => setSettings((prev) => prev ? { ...prev, shellOverride: event.target.value } : prev)}
              />
            </label>

            <div className={styles.settingsActions}>
              <Button type="button" variant="ghost" onClick={() => setSettingsOpen(false)}>{t.close}</Button>
              <Button type="button" onClick={() => void saveSettings()}>{t.save}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

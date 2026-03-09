import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WidgetRenderProps } from '../../../entities/widget/model/types'
import { Button } from '@shared/ui/Button'
import { IconCircle } from '@shared/ui/IconCircle'
import { ModalSurface } from '@shared/ui/ModalSurface'
import { OptionSelect } from '@shared/ui/OptionSelect'
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
  codexModel: string
  geminiCommand: string
  geminiArgs: string[]
  geminiModel: string
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

type DialogRefItem = {
  providerSessionRef: string
  createdAt: string
  updatedAt: string
  lastStatus: string
}

type ModelListPayload = {
  items?: Array<{ value: string; label: string }>
  error?: string
}

type ParsedSseChunk = {
  eventName: string
  payload: Record<string, unknown>
}

function AgentWrenchGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: 'rotate(-18deg)' }}>
      <circle cx="12" cy="12" r="2.8" fill="#F8FAFC" stroke="#64748B" />
      <path
        d="M12 4.85v1.65M12 17.5v1.65M19.15 12H17.5M6.5 12H4.85M17.15 6.85l-1.2 1.2M8.05 15.95l-1.2 1.2M17.15 17.15l-1.2-1.2M8.05 8.05l-1.2-1.2"
        stroke="#94A3B8"
      />
      <path
        d="M12 7.15a4.85 4.85 0 1 1 0 9.7 4.85 4.85 0 0 1 0-9.7Z"
        fill="#E2E8F0"
        stroke="#64748B"
      />
      <circle cx="12" cy="12" r="1.65" fill="#FFFFFF" stroke="#475569" />
    </svg>
  )
}

function NewDialogGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="7.2" fill="#EDE9FE" stroke="#8B5CF6" />
      <path d="M12 8.4v7.2" stroke="#7C3AED" />
      <path d="M8.4 12h7.2" stroke="#7C3AED" />
    </svg>
  )
}

function ModelGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="7.2" fill="#CCFBF1" stroke="#14B8A6" />
      <path d="M7.25 13.35v-2.7" stroke="#0F766E" />
      <path d="M10.5 15.7V8.3" stroke="#0F766E" />
      <path d="M13.75 17.2V6.8" stroke="#0F766E" />
      <path d="M17 14.6V9.4" stroke="#0F766E" />
    </svg>
  )
}

function DialogsGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="5.5" width="15" height="13" rx="2.6" fill="#DBEAFE" stroke="#3B82F6" />
      <path d="M8 10h8M8 13h8" stroke="#1D4ED8" />
    </svg>
  )
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

function getMessagesStorageKey(provider: Provider, sessionRef: string) {
  return `terminal-agent:messages:${provider}:${sessionRef || '__current'}`
}

function normalizeForCompare(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function appendChunkWithSpacing(previous: string, chunk: string) {
  if (!previous || !chunk) {
    return previous + chunk
  }

  const prevLast = previous.at(-1) ?? ''
  const nextFirst = chunk[0] ?? ''
  const prevIsWord = /[\p{L}\p{N}]/u.test(prevLast)
  const nextIsWord = /[\p{L}\p{N}]/u.test(nextFirst)
  if (!prevIsWord || !nextIsWord) {
    return `${previous}${chunk}`
  }

  const nextIsLowerLetter = /\p{Ll}/u.test(nextFirst)
  const needsGap = !nextIsLowerLetter

  return needsGap ? `${previous} ${chunk}` : `${previous}${chunk}`
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
    codexModel: 'Codex model',
    geminiCommand: 'Gemini command path',
    geminiArgs: 'Gemini args (через пробел)',
    geminiModel: 'Gemini model',
    shellFallback: 'Разрешить shell fallback',
    shellOverride: 'Shell override',
    resumeRef: 'Диалог',
    status: 'Статус',
    settingsTitle: 'Настройки агента',
    model: 'модель',
    resumeFailed: 'Не удалось восстановить continuity. Нажми "Новый диалог".',
    dialogs: 'Диалоги',
    selectDialog: 'Выбор диалога',
    dialogIdCol: 'Диалог (id)',
    dialogCreatedCol: 'Дата создания',
    dialogStatusCol: 'Статус',
    accept: 'Принять',
    cancel: 'Отмена',
    emptyDialogs: 'Список диалогов пуст.',
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
    codexModel: 'Codex model',
    geminiCommand: 'Gemini command path',
    geminiArgs: 'Gemini args (space separated)',
    geminiModel: 'Gemini model',
    shellFallback: 'Allow shell fallback',
    shellOverride: 'Shell override',
    resumeRef: 'Dialog',
    status: 'Status',
    settingsTitle: 'Agent settings',
    model: 'model',
    resumeFailed: 'Continuity restore failed. Start a new dialog.',
    dialogs: 'Dialogs',
    selectDialog: 'Select dialog',
    dialogIdCol: 'Dialog (id)',
    dialogCreatedCol: 'Created at',
    dialogStatusCol: 'Status',
    accept: 'Apply',
    cancel: 'Cancel',
    emptyDialogs: 'No dialogs yet.',
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
  const [dialogsOpen, setDialogsOpen] = useState(false)
  const [resumeFailed, setResumeFailed] = useState(false)
  const [dialogRefs, setDialogRefs] = useState<DialogRefItem[]>([])
  const [selectedDialogRef, setSelectedDialogRef] = useState('')
  const [dialogsLoading, setDialogsLoading] = useState(false)
  const [codexModelOptions, setCodexModelOptions] = useState<Array<{ value: string; label: string }>>([
    { value: 'gpt-5-codex', label: 'gpt-5-codex' },
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-4.1', label: 'gpt-4.1' },
  ])
  const [geminiModelOptions, setGeminiModelOptions] = useState<Array<{ value: string; label: string }>>([
    { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
    { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
    { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
  ])
  const hydratedMessagesKeyRef = useRef('')
  const previousMessagesKeyRef = useRef('')
  const messagesRef = useRef<MessageItem[]>([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const themeClass = props.theme === 'night' ? styles.night : styles.day
  const actionThemeClass = props.theme === 'night' ? styles.actionButtonNight : ''

  const activeProvider: Provider = settings?.activeProvider ?? 'codex'
  const activeModel = settings
    ? (activeProvider === 'codex' ? settings.codexModel : settings.geminiModel)
    : ''

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

  useEffect(() => {
    if (!settings) {
      return
    }

    const sessionRef = dialogState?.providerSessionRef || '__current'
    const storageKey = getMessagesStorageKey(activeProvider, sessionRef)
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
  }, [activeProvider, dialogState?.providerSessionRef, settings])

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

  const loadModels = useCallback(async (provider: Provider) => {
    const response = await fetch(`/api/widget/com.yulia.terminal-agent/models?provider=${encodeURIComponent(provider)}`)
    const data = await response.json() as ModelListPayload
    if (!response.ok) {
      throw new Error(toText(data.error) || 'Failed to load models.')
    }

    const fallback = provider === 'codex'
      ? [{ value: 'gpt-5-codex', label: 'gpt-5-codex' }]
      : [{ value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' }]
    const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : fallback
    if (provider === 'codex') {
      setCodexModelOptions(items)
    } else {
      setGeminiModelOptions(items)
    }
  }, [])

  const loadDialogRefs = useCallback(async (provider: Provider) => {
    setDialogsLoading(true)
    try {
      const response = await fetch(`/api/widget/com.yulia.terminal-agent/dialogs?provider=${encodeURIComponent(provider)}`)
      const data = await response.json() as { items?: DialogRefItem[]; error?: string }
      if (!response.ok) {
        throw new Error(toText(data.error) || 'Failed to load dialogs.')
      }

      const items = Array.isArray(data.items) ? data.items : []
      setDialogRefs(items)
      setSelectedDialogRef(items[0]?.providerSessionRef ?? '')
    } finally {
      setDialogsLoading(false)
    }
  }, [])

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

  const openDialogs = useCallback(async () => {
    setError(null)
    await loadDialogRefs(activeProvider)
    setDialogsOpen(true)
  }, [activeProvider, loadDialogRefs])

  const selectDialog = useCallback(async () => {
    if (!selectedDialogRef) {
      return
    }

    setError(null)
    const response = await fetch('/api/widget/com.yulia.terminal-agent/dialog/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: activeProvider,
        providerSessionRef: selectedDialogRef,
      }),
    })
    const data = await response.json() as DialogStatePayload
    if (!response.ok) {
      throw new Error(toText((data as Record<string, unknown>).error) || 'Failed to select dialog.')
    }

    setDialogState(data)
    setStatusLine(data.status || 'resuming')
    setResumeFailed(false)
    setMessages([])
    setDialogsOpen(false)
  }, [activeProvider, selectedDialogRef])

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

            setMessages((prev) => prev.map((entry) => {
              if (entry.id !== assistantMessageId) {
                return entry
              }

              // Some providers can echo the prompt as a first chunk.
              if (!entry.text && normalizeForCompare(text) === normalizeForCompare(message)) {
                return entry
              }

              return { ...entry, text: appendChunkWithSpacing(entry.text, text) }
            }))
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

  useEffect(() => {
    if (!settings) {
      return
    }

    void loadModels(settings.activeProvider).catch(() => {
      // keep fallback options in UI
    })
  }, [loadModels, settings])

  return (
    <div className={[styles.root, themeClass].join(' ')}>
      <div className={styles.toolbar}>
        <div className={styles.meta}>
          <strong>{activeProvider === 'codex' ? 'Codex' : 'Gemini CLI'}</strong>
          <span>{t.status}: {statusLine}</span>
          <span>{t.resumeRef}: {dialogState?.providerSessionRef || '—'}</span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={[styles.actionButton, styles.actionButtonSecondary, actionThemeClass].join(' ').trim()}
            onClick={() => void createNewDialog()}
          >
            <span className={styles.actionButtonIcon}><NewDialogGlyph /></span>
            <span>{t.newDialog}</span>
          </button>
          <IconCircle type="button" theme={props.theme} title={t.settings} onClick={() => setSettingsOpen(true)}>
            <AgentWrenchGlyph />
          </IconCircle>
          <button
            type="button"
            className={[styles.actionButton, styles.actionButtonSecondary, actionThemeClass].join(' ').trim()}
            onClick={() => void openDialogs()}
          >
            <span className={styles.actionButtonIcon}><DialogsGlyph /></span>
            <span>{t.dialogs}</span>
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {resumeFailed ? <p className={styles.warning}>{t.resumeFailed}</p> : null}

      <div className={styles.chatList}>
        {messages.map((entry) => (
          <article key={entry.id} className={[styles.bubble, entry.role === 'user' ? styles.user : styles.assistant].join(' ')}>
            {entry.text ? entry.text : entry.role === 'assistant' && sending ? (
              <span className={styles.typingIndicator} aria-label={t.sending}>
                <span />
                <span />
                <span />
              </span>
            ) : ''}
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
        <span className={styles.sendModelInfo}>{
          props.locale === 'ru'
            ? `Модель: ${activeModel || (activeProvider === 'codex' ? 'Codex' : 'Gemini')}`
            : `Model: ${activeModel || (activeProvider === 'codex' ? 'Codex' : 'Gemini')}`
        }</span>
        <button
          type="submit"
          className={[styles.actionButton, styles.actionButtonPrimary, actionThemeClass].join(' ').trim()}
          disabled={sending || !input.trim()}
        >
          <span className={styles.actionButtonIcon}><ModelGlyph /></span>
          <span>{sending ? t.sending : t.send}</span>
        </button>
      </form>

      {settingsOpen && settings ? (
        <ModalSurface
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          ariaLabel={t.settings}
          theme={props.theme}
          panelClassName={styles.settingsPanel}
        >
            <div className={styles.settingsHeader}>
              <h4>{t.settingsTitle}</h4>
              <IconCircle type="button" theme={props.theme} title={t.close} onClick={() => setSettingsOpen(false)}>
                ✕
              </IconCircle>
            </div>
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
                  void loadModels(next).catch(() => {
                    // keep fallback options
                  })
                }}
              />
            </div>

            {settings.activeProvider === 'codex' ? (
              <>
                <label>
                  {t.codexKey}
                  <input
                    value={settings.codexApiKey}
                    onChange={(event) => setSettings((prev) => prev ? { ...prev, codexApiKey: event.target.value } : prev)}
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
                <div className={styles.field}>
                  {t.codexModel}
                  <OptionSelect
                    theme={props.theme}
                    value={settings.codexModel}
                    options={codexModelOptions}
                    onChange={(value) => setSettings((prev) => prev ? { ...prev, codexModel: value } : prev)}
                  />
                </div>
              </>
            ) : (
              <>
                <label>
                  {t.geminiKey}
                  <input
                    value={settings.geminiApiKey}
                    onChange={(event) => setSettings((prev) => prev ? { ...prev, geminiApiKey: event.target.value } : prev)}
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
                <div className={styles.field}>
                  {t.geminiModel}
                  <OptionSelect
                    theme={props.theme}
                    value={settings.geminiModel}
                    options={geminiModelOptions}
                    onChange={(value) => setSettings((prev) => prev ? { ...prev, geminiModel: value } : prev)}
                  />
                </div>
              </>
            )}
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
        </ModalSurface>
      ) : null}

      {dialogsOpen ? (
        <ModalSurface
          open={dialogsOpen}
          onClose={() => setDialogsOpen(false)}
          ariaLabel={t.selectDialog}
          theme={props.theme}
          panelClassName={styles.dialogsPanel}
        >
          <div className={styles.settingsHeader}>
            <h4>{t.selectDialog}</h4>
            <IconCircle type="button" theme={props.theme} title={t.cancel} onClick={() => setDialogsOpen(false)}>
              ✕
            </IconCircle>
          </div>
          <div className={styles.dialogsTableWrap}>
            <table className={styles.dialogsTable}>
              <thead>
                <tr>
                  <th>{t.dialogIdCol}</th>
                  <th>{t.dialogCreatedCol}</th>
                  <th>{t.dialogStatusCol}</th>
                </tr>
              </thead>
              <tbody>
                {dialogRefs.length === 0 ? (
                  <tr>
                    <td colSpan={3}>{dialogsLoading ? t.sending : t.emptyDialogs}</td>
                  </tr>
                ) : dialogRefs.map((item) => (
                  <tr
                    key={item.providerSessionRef}
                    className={selectedDialogRef === item.providerSessionRef ? styles.dialogRowActive : ''}
                    onClick={() => setSelectedDialogRef(item.providerSessionRef)}
                  >
                    <td>{item.providerSessionRef}</td>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                    <td>{item.lastStatus || 'done'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.settingsActions}>
            <Button type="button" variant="ghost" onClick={() => setDialogsOpen(false)}>{t.cancel}</Button>
            <Button
              type="button"
              className={styles.acceptButton}
              onClick={() => void selectDialog()}
              disabled={!selectedDialogRef}
            >
              {t.accept}
            </Button>
          </div>
        </ModalSurface>
      ) : null}
    </div>
  )
}

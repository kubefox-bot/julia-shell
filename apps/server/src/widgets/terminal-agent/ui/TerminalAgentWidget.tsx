import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WidgetRenderProps } from '../../../entities/widget/model/types'
import { Button } from '@shared/ui/Button'
import { IconCircle } from '@shared/ui/IconCircle'
import { ModalSurface } from '@shared/ui/ModalSurface'
import { OptionSelect } from '@shared/ui/OptionSelect'
import { TerminalAgentMessages } from './components/TerminalAgentMessages'
import { terminalAgentDictionary } from './terminal-agent.dictionary'
import { AgentWrenchGlyph, DialogsGlyph, ModelGlyph, NewDialogGlyph } from './terminal-agent.icons'
import type {
  DialogRefItem,
  DialogStatePayload,
  MessageItem,
  ModelListPayload,
  Provider,
  RetryState,
  SettingsPayload,
} from './terminal-agent.types'
import {
  appendChunkWithSpacing,
  getMessagesStorageKey,
  isQuotaErrorMessage,
  normalizeForCompare,
  parseArgsInput,
  parseSseEventChunk,
} from './terminal-agent.utils'
import styles from './TerminalAgentWidget.module.scss'
import { toText } from '@/shared/utils'

export function TerminalAgentWidget(props: WidgetRenderProps) {
  const t = terminalAgentDictionary[props.locale]
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
  const [retryState, setRetryState] = useState<RetryState | null>(null)
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
  const localizedStatus = statusLine === 'idle'
    ? t.statusIdle
    : statusLine === 'running'
      ? t.statusRunning
      : statusLine === 'resuming'
        ? t.statusResuming
        : statusLine === 'thinking'
          ? t.statusThinking
          : statusLine === 'tool_call'
            ? t.statusToolCall
            : statusLine === 'done'
              ? t.statusDone
              : statusLine === 'error'
                ? t.statusError
                : statusLine
  const displayError = error
    ? (isQuotaErrorMessage(error) ? t.quotaExceeded : error)
    : null

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
    setRetryState(null)

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
    setRetryState(null)
    setMessages([])
    setDialogsOpen(false)
  }, [activeProvider, selectedDialogRef])

  const sendMessage = useCallback(async (options?: {
    message?: string
    appendUser?: boolean
    userMessageId?: string
  }) => {
    const message = (options?.message ?? input).trim()
    if (!message || !settings || sending) {
      return
    }

    const appendUser = options?.appendUser ?? true
    setSending(true)
    setError(null)
    setResumeFailed(false)
    setRetryState(null)
    if (appendUser) {
      setInput('')
    }

    const userMessageId = options?.userMessageId ?? `${Date.now()}-user`
    const assistantMessageId = `${Date.now()}-assistant`

    setMessages((prev) => {
      const next = appendUser
        ? [...prev, { id: userMessageId, role: 'user' as const, text: message }]
        : [...prev]
      next.push({ id: assistantMessageId, role: 'assistant' as const, text: '' })
      return next
    })
    let gotAssistantChunk = false

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
            gotAssistantChunk = true

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
            if (!gotAssistantChunk) {
              setMessages((prev) => prev.filter((entry) => entry.id !== assistantMessageId))
              setRetryState({ message, userMessageId })
              setStatusLine('error')
              continue
            }

            const providerRef = toText(parsed.payload.providerRef)
            setDialogState((prev) => prev ? {
              ...prev,
              providerSessionRef: providerRef || prev.providerSessionRef,
              dialogTitle: prev.dialogTitle || message.trim(),
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
      setMessages((prev) => prev.filter((entry) => entry.id !== assistantMessageId))
      setRetryState({ message, userMessageId })
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
          <span>{t.status}: {localizedStatus}</span>
          <span>{t.resumeRef}: {dialogState?.dialogTitle || dialogState?.providerSessionRef || '—'}</span>
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
          <button
            type="button"
            className={[styles.actionButton, styles.actionButtonSecondary, actionThemeClass].join(' ').trim()}
            onClick={() => void openDialogs()}
          >
            <span className={styles.actionButtonIcon}><DialogsGlyph /></span>
            <span>{t.dialogs}</span>
          </button>
          <IconCircle type="button" theme={props.theme} title={t.settings} onClick={() => setSettingsOpen(true)}>
            <AgentWrenchGlyph />
          </IconCircle>
        </div>
      </div>

      {displayError ? <p className={styles.error}>{displayError}</p> : null}
      {resumeFailed ? <p className={styles.warning}>{t.resumeFailed}</p> : null}
      <TerminalAgentMessages
        messages={messages}
        sending={sending}
        retryState={retryState}
        t={t}
        styles={styles}
        onRetry={(payload) => {
          void sendMessage({
            message: payload.message,
            appendUser: false,
            userMessageId: payload.userMessageId,
          })
        }}
      />

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
                    <td>{item.dialogTitle || item.providerSessionRef}</td>
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

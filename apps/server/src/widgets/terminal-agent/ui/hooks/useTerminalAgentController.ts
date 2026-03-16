import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WidgetRenderProps } from '../../../../entities/widget/model/types'
import {
  createTerminalAgentDialog,
  loadTerminalAgentDialogRefs,
  loadTerminalAgentDialogState,
  loadTerminalAgentModels,
  loadTerminalAgentSettings,
  saveTerminalAgentSettings,
  selectTerminalAgentDialog,
} from '../terminal-agent.api'
import type { DialogRefItem, DialogStatePayload, Provider, RetryState, SettingsPayload } from '../terminal-agent.types'
import { useTerminalAgentStorage } from './useTerminalAgentStorage'
import { useTerminalAgentMessageActions } from './useTerminalAgentMessageActions'

const DEFAULT_CODEX_MODELS = [{ value: 'gpt-5-codex', label: 'gpt-5-codex' }]
const DEFAULT_GEMINI_MODELS = [{ value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' }]

function resolveFallbackModels(provider: Provider) {
  return provider === 'codex' ? DEFAULT_CODEX_MODELS : DEFAULT_GEMINI_MODELS
}

export function useTerminalAgentController(props: WidgetRenderProps) {
  const [settings, setSettings] = useState<SettingsPayload | null>(null)
  const [dialogState, setDialogState] = useState<DialogStatePayload | null>(null)
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
  const [codexModelOptions, setCodexModelOptions] = useState(DEFAULT_CODEX_MODELS)
  const [geminiModelOptions, setGeminiModelOptions] = useState(DEFAULT_GEMINI_MODELS)

  const activeProvider: Provider = settings?.activeProvider ?? 'codex'
  const { messages, setMessages } = useTerminalAgentStorage({
    activeProvider,
    sessionRef: dialogState?.providerSessionRef || '__current',
    enabled: Boolean(settings),
  })

  const providerOptions = useMemo(
    () => (settings?.providers ?? []).map((entry) => ({ value: entry.value, label: entry.label })),
    [settings?.providers],
  )

  const loadDialogState = useCallback(async (provider: Provider) => {
    const data = await loadTerminalAgentDialogState(provider)
    setDialogState(data)
    setStatusLine(data.status || 'idle')
    setError(data.lastError)
  }, [])

  const loadModels = useCallback(async (provider: Provider) => {
    const data = await loadTerminalAgentModels(provider)
    const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : resolveFallbackModels(provider)
    if (provider === 'codex') {
      setCodexModelOptions(items)
      return
    }
    setGeminiModelOptions(items)
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadTerminalAgentSettings()
      .then((data) => {
        if (!cancelled) {
          setSettings(data)
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load widget.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (settings) {
      void loadDialogState(settings.activeProvider)
    }
  }, [loadDialogState, settings])

  useEffect(() => {
    if (settings) {
      void loadModels(settings.activeProvider).catch(() => {
        // keep fallback options in UI
      })
    }
  }, [loadModels, settings])

  const saveSettings = useCallback(async () => {
    if (!settings) {
      return
    }

    setError(null)
    const data = await saveTerminalAgentSettings(settings)
    setSettings(data)
    setSettingsOpen(false)
  }, [settings])

  const createNewDialog = useCallback(async () => {
    setError(null)
    setResumeFailed(false)
    setRetryState(null)
    const data = await createTerminalAgentDialog(activeProvider)
    setDialogState(data)
    setMessages([])
    setStatusLine('idle')
  }, [activeProvider, setMessages])

  const openDialogs = useCallback(async () => {
    setError(null)
    setDialogsLoading(true)
    try {
      const data = await loadTerminalAgentDialogRefs(activeProvider)
      const items = Array.isArray(data.items) ? data.items : []
      setDialogRefs(items)
      setSelectedDialogRef(items[0]?.providerSessionRef ?? '')
      setDialogsOpen(true)
    } finally {
      setDialogsLoading(false)
    }
  }, [activeProvider])

  const selectDialog = useCallback(async () => {
    if (!selectedDialogRef) {
      return
    }

    setError(null)
    const data = await selectTerminalAgentDialog(activeProvider, selectedDialogRef)
    setDialogState(data)
    setStatusLine(data.status || 'resuming')
    setResumeFailed(false)
    setRetryState(null)
    setMessages([])
    setDialogsOpen(false)
  }, [activeProvider, selectedDialogRef, setMessages])

  const sendMessage = useTerminalAgentMessageActions({
    input,
    sending,
    settings,
    setInput,
    setSending,
    setError,
    setResumeFailed,
    setRetryState,
    setStatusLine,
    setDialogState,
    setMessages,
  })


  return {
    props,
    settings,
    setSettings,
    dialogState,
    input,
    setInput,
    statusLine,
    error,
    sending,
    settingsOpen,
    setSettingsOpen,
    dialogsOpen,
    setDialogsOpen,
    resumeFailed,
    retryState,
    dialogRefs,
    selectedDialogRef,
    setSelectedDialogRef,
    dialogsLoading,
    codexModelOptions,
    geminiModelOptions,
    providerOptions,
    activeProvider,
    messages,
    loadDialogState,
    loadModels,
    saveSettings,
    createNewDialog,
    openDialogs,
    selectDialog,
    sendMessage,
  }
}

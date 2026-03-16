import { fetchWithRequestHeaders } from '@shared/lib/request-headers'
import { terminalAgentManifest } from '../manifest'
import type { DialogRefItem, DialogStatePayload, ModelListPayload, Provider, SettingsPayload } from './terminal-agent.types'
import { toText } from '@shared/utils'

export const WIDGET_META = {
  id: terminalAgentManifest.id,
  version: terminalAgentManifest.version,
} as const

async function readPayload<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json() as T & { error?: string }
  if (!response.ok) {
    throw new Error(toText(data.error) || fallbackMessage)
  }
  return data
}

export async function loadTerminalAgentSettings() {
  const response = await fetchWithRequestHeaders('/api/widget/com.yulia.terminal-agent/settings', undefined, {
    widget: WIDGET_META,
  })
  return readPayload<SettingsPayload>(response, 'Failed to load settings.')
}

export async function loadTerminalAgentDialogState(provider: Provider) {
  const response = await fetchWithRequestHeaders(
    `/api/widget/com.yulia.terminal-agent/dialog-state?provider=${encodeURIComponent(provider)}`,
    undefined,
    { widget: WIDGET_META },
  )
  return readPayload<DialogStatePayload>(response, 'Failed to load dialog state.')
}

export async function saveTerminalAgentSettings(settings: SettingsPayload) {
  const response = await fetchWithRequestHeaders(
    '/api/widget/com.yulia.terminal-agent/settings',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    },
    { widget: WIDGET_META },
  )
  return readPayload<SettingsPayload>(response, 'Failed to save settings.')
}

export async function loadTerminalAgentModels(provider: Provider) {
  const response = await fetchWithRequestHeaders(
    `/api/widget/com.yulia.terminal-agent/models?provider=${encodeURIComponent(provider)}`,
    undefined,
    { widget: WIDGET_META },
  )
  return readPayload<ModelListPayload>(response, 'Failed to load models.')
}

export async function loadTerminalAgentDialogRefs(provider: Provider) {
  const response = await fetchWithRequestHeaders(
    `/api/widget/com.yulia.terminal-agent/dialogs?provider=${encodeURIComponent(provider)}`,
    undefined,
    { widget: WIDGET_META },
  )
  return readPayload<{ items?: DialogRefItem[] }>(response, 'Failed to load dialogs.')
}

export async function createTerminalAgentDialog(provider: Provider) {
  const response = await fetchWithRequestHeaders(
    '/api/widget/com.yulia.terminal-agent/dialog/new',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    },
    { widget: WIDGET_META },
  )
  return readPayload<DialogStatePayload>(response, 'Failed to reset dialog.')
}

export async function selectTerminalAgentDialog(provider: Provider, providerSessionRef: string) {
  const response = await fetchWithRequestHeaders(
    '/api/widget/com.yulia.terminal-agent/dialog/select',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, providerSessionRef }),
    },
    { widget: WIDGET_META },
  )
  return readPayload<DialogStatePayload>(response, 'Failed to select dialog.')
}

export function openTerminalAgentMessageStream(provider: Provider, message: string) {
  return fetchWithRequestHeaders(
    '/api/widget/com.yulia.terminal-agent/message-stream',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, message }),
    },
    { widget: WIDGET_META },
  )
}

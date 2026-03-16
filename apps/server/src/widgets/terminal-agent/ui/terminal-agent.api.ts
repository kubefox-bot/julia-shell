import { defineQuery, requestJson, requestRaw } from '@shared/lib/request'
import { TERMINAL_AGENT_WIDGET_META } from '../meta'
import type { DialogRefItem, DialogStatePayload, ModelListPayload, Provider, SettingsPayload } from './terminal-agent.types'

export async function loadTerminalAgentSettings() {
  return requestJson<SettingsPayload>('/api/widget/com.yulia.terminal-agent/settings', {
    widget: TERMINAL_AGENT_WIDGET_META,
  }, 'Failed to load settings.')
}

export async function loadTerminalAgentDialogState(provider: Provider) {
  return requestJson<DialogStatePayload>(
    `/api/widget/com.yulia.terminal-agent/dialog-state?provider=${encodeURIComponent(provider)}`,
    { widget: TERMINAL_AGENT_WIDGET_META },
    'Failed to load dialog state.'
  )
}

export async function saveTerminalAgentSettings(settings: SettingsPayload) {
  return requestJson<SettingsPayload>(
    '/api/widget/com.yulia.terminal-agent/settings',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
      widget: TERMINAL_AGENT_WIDGET_META,
    },
    'Failed to save settings.'
  )
}

export async function loadTerminalAgentModels(provider: Provider) {
  return requestJson<ModelListPayload>(
    `/api/widget/com.yulia.terminal-agent/models?provider=${encodeURIComponent(provider)}`,
    { widget: TERMINAL_AGENT_WIDGET_META },
    'Failed to load models.'
  )
}

export async function loadTerminalAgentDialogRefs(provider: Provider) {
  return requestJson<{ items?: DialogRefItem[] }>(
    `/api/widget/com.yulia.terminal-agent/dialogs?provider=${encodeURIComponent(provider)}`,
    { widget: TERMINAL_AGENT_WIDGET_META },
    'Failed to load dialogs.'
  )
}

export async function createTerminalAgentDialog(provider: Provider) {
  return requestJson<DialogStatePayload>(
    '/api/widget/com.yulia.terminal-agent/dialog/new',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
      widget: TERMINAL_AGENT_WIDGET_META,
    },
    'Failed to reset dialog.'
  )
}

export async function selectTerminalAgentDialog(provider: Provider, providerSessionRef: string) {
  return requestJson<DialogStatePayload>(
    '/api/widget/com.yulia.terminal-agent/dialog/select',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, providerSessionRef }),
      widget: TERMINAL_AGENT_WIDGET_META,
    },
    'Failed to select dialog.'
  )
}

export function openTerminalAgentMessageStream(provider: Provider, message: string) {
  return requestRaw(
    '/api/widget/com.yulia.terminal-agent/message-stream',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, message }),
      widget: TERMINAL_AGENT_WIDGET_META,
    },
  )
}

export const terminalAgentQueryKeys = {
  settings: () => ['terminal-agent', 'settings'] as const,
  dialogState: (provider: Provider) => ['terminal-agent', 'dialog-state', provider] as const,
  models: (provider: Provider) => ['terminal-agent', 'models', provider] as const,
  dialogs: (provider: Provider) => ['terminal-agent', 'dialogs', provider] as const
}

export const terminalAgentSettingsQuery = defineQuery(terminalAgentQueryKeys.settings(), loadTerminalAgentSettings)

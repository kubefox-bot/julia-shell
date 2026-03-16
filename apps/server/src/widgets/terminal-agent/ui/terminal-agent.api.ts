import { defineQuery, requestJson, requestRaw } from '@shared/lib/request'
import { TERMINAL_AGENT_WIDGET_ID } from '@/widgets'
import { TERMINAL_AGENT_WIDGET_META } from '../meta'
import type { DialogRefItem, DialogStatePayload, ModelListPayload, Provider, SettingsPayload } from './terminal-agent.types'

const TERMINAL_AGENT_WIDGET_ROUTE_PREFIX = `/api/widget/${TERMINAL_AGENT_WIDGET_ID}`

export async function loadTerminalAgentSettings() {
  return requestJson<SettingsPayload>(`${TERMINAL_AGENT_WIDGET_ROUTE_PREFIX}/settings`, {
    widget: TERMINAL_AGENT_WIDGET_META,
  }, 'Failed to load settings.')
}

export async function loadTerminalAgentDialogState(provider: Provider) {
  return requestJson<DialogStatePayload>(
    `${TERMINAL_AGENT_WIDGET_ROUTE_PREFIX}/dialog-state?provider=${encodeURIComponent(provider)}`,
    { widget: TERMINAL_AGENT_WIDGET_META },
    'Failed to load dialog state.'
  )
}

export async function saveTerminalAgentSettings(settings: SettingsPayload) {
  return requestJson<SettingsPayload>(
    `${TERMINAL_AGENT_WIDGET_ROUTE_PREFIX}/settings`,
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
    `${TERMINAL_AGENT_WIDGET_ROUTE_PREFIX}/models?provider=${encodeURIComponent(provider)}`,
    { widget: TERMINAL_AGENT_WIDGET_META },
    'Failed to load models.'
  )
}

export async function loadTerminalAgentDialogRefs(provider: Provider) {
  return requestJson<{ items?: DialogRefItem[] }>(
    `${TERMINAL_AGENT_WIDGET_ROUTE_PREFIX}/dialogs?provider=${encodeURIComponent(provider)}`,
    { widget: TERMINAL_AGENT_WIDGET_META },
    'Failed to load dialogs.'
  )
}

export async function createTerminalAgentDialog(provider: Provider) {
  return requestJson<DialogStatePayload>(
    `${TERMINAL_AGENT_WIDGET_ROUTE_PREFIX}/dialog/new`,
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
    `${TERMINAL_AGENT_WIDGET_ROUTE_PREFIX}/dialog/select`,
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
    `${TERMINAL_AGENT_WIDGET_ROUTE_PREFIX}/message-stream`,
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

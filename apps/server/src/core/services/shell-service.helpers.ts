import { SHELL_LAYOUT_COLUMNS_MAX, SHELL_LAYOUT_COLUMNS_MIN } from '@app/shell/model/constants'
import { passportRuntime } from '@passport/server/runtime'
import { WIDGET_SIZE_SET } from '@/entities/widget/model'
import { TERMINAL_AGENT_WIDGET_ID, TRANSCRIBE_WIDGET_ID } from '@/widgets'
import type {
  HostPlatform,
  LayoutItem,
  WidgetDescriptor,
} from '../../entities/widget/model/types'
import { setModuleEnabled } from '../db/core-repository'

const AUTO_NOT_READY_REASON_PREFIX = 'auto:not-ready:'
const DEFAULT_HOST_PLATFORM: HostPlatform = 'linux'
const HOST_PLATFORM_BY_NODE_PLATFORM = new Map<NodeJS.Platform, HostPlatform>([
  ['win32', 'windows'],
  ['darwin', 'macos'],
])
const PASSPORT_REQUIRED_WIDGET_IDS = new Set([
  TRANSCRIBE_WIDGET_ID,
  TERMINAL_AGENT_WIDGET_ID,
])
const ONLINE_AGENT_REQUIREMENT_BY_WIDGET_ID: Record<string, boolean> = {
  [TERMINAL_AGENT_WIDGET_ID]: true,
  [TRANSCRIBE_WIDGET_ID]: true,
}

export function resolveHostPlatform(): HostPlatform {
  return HOST_PLATFORM_BY_NODE_PLATFORM.get(process.platform) ?? DEFAULT_HOST_PLATFORM
}

export function sanitizeColumns(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  const rounded = Math.round(value)
  return Math.max(SHELL_LAYOUT_COLUMNS_MIN, Math.min(SHELL_LAYOUT_COLUMNS_MAX, rounded))
}

export function normalizeLayoutItems(items: LayoutItem[]) {
  const seen = new Set<string>()
  return items
    .filter((item) => {
      if (!item.widgetId?.trim()) return false
      if (seen.has(item.widgetId)) return false
      if (!WIDGET_SIZE_SET.has(item.size)) return false
      seen.add(item.widgetId)
      return true
    })
    .map((item, index) => ({
      widgetId: item.widgetId,
      order: index,
      size: item.size,
    }))
}

function requiresCurrentOnlineAgent(widgetId: string) {
  return ONLINE_AGENT_REQUIREMENT_BY_WIDGET_ID[widgetId] ?? false
}

export function buildPassportNotReadyReasons(widgetId: string, agentId: string, hasPassportAccess: boolean) {
  if (PASSPORT_REQUIRED_WIDGET_IDS.has(widgetId) && !hasPassportAccess) {
    return [`${widgetId} widget requires agent.`]
  }

  if (
    hasPassportAccess &&
    requiresCurrentOnlineAgent(widgetId) &&
    !passportRuntime.getOnlineAgentSession(agentId)
  ) {
    return [`${widgetId} widget requires agent.`]
  }

  return []
}

export async function collectRuntimeNotReadyReasons(descriptor: WidgetDescriptor) {
  if (PASSPORT_REQUIRED_WIDGET_IDS.has(descriptor.module.manifest.id)) {
    return []
  }

  try {
    const serverModule = await descriptor.module.loadServerModule()
    if (!serverModule.init) {
      return []
    }

    const initResult = await serverModule.init()
    if (!initResult || initResult.ready !== false) {
      return []
    }

    return [initResult.reason?.trim() || 'init() returned not ready.']
  } catch (error) {
    return [error instanceof Error ? error.message : 'loadServerModule() failed.']
  }
}

export function resolveModuleEnabledState(input: {
  agentId: string
  widgetId: string
  enabled: boolean
  notReadyReasons: string[]
  wasAutoDisabled: boolean
}) {
  const runtimeReady = input.notReadyReasons.length === 0
  let enabled = input.enabled

  if (!runtimeReady && enabled) {
    const reason = input.notReadyReasons[0] ?? 'Widget is not ready.'
    setModuleEnabled(input.agentId, input.widgetId, false, `${AUTO_NOT_READY_REASON_PREFIX}${reason}`)
    enabled = false
  }

  if (runtimeReady && !enabled && input.wasAutoDisabled) {
    setModuleEnabled(input.agentId, input.widgetId, true, null)
    enabled = true
  }

  return {
    runtimeReady,
    enabled,
  }
}

export function isAutoDisabledReason(reason: string | null | undefined) {
  return Boolean(reason?.startsWith(AUTO_NOT_READY_REASON_PREFIX))
}

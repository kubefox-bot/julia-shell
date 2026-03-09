import { readRuntimeEnv } from '@core/env'
import { PASSPORT_WIDGET_ID_TERMINAL_AGENT, PASSPORT_WIDGET_ID_TRANSCRIBE } from '../config/consts'
import type { PassportRequestContext } from '../context'
import { passportRuntime } from '../runtime/runtime'
import type { PassportWidgetProviderSnapshot } from '../types'
import { isPassportProtectedWidget } from './widget-policy'

function resolveRequiresOnlineAgent(widgetId: string) {
  if (widgetId === PASSPORT_WIDGET_ID_TERMINAL_AGENT) {
    return true
  }

  if (widgetId !== PASSPORT_WIDGET_ID_TRANSCRIBE) {
    return false
  }

  return !readRuntimeEnv().passportAgentDevModeEnabled
}

/**
 * Builds unified widget-readiness snapshot for standalone widget packages.
 */
export function resolvePassportWidgetProviderSnapshot(
  widgetId: string,
  context: PassportRequestContext | null
): PassportWidgetProviderSnapshot {
  const hasAccessToken = Boolean(context?.accessJwt)
  const requiresAccessToken = isPassportProtectedWidget(widgetId)
  const requiresOnlineAgent = resolveRequiresOnlineAgent(widgetId)
  const hasOnlineAgent = Boolean(passportRuntime.getOnlineAgentSession())

  if (widgetId !== PASSPORT_WIDGET_ID_TRANSCRIBE && widgetId !== PASSPORT_WIDGET_ID_TERMINAL_AGENT) {
    return {
      widgetId,
      status: 'unsupported_widget',
      ready: true,
      requiresAccessToken,
      hasAccessToken,
      requiresOnlineAgent,
      hasOnlineAgent,
      reason: null
    }
  }

  if (requiresAccessToken && !hasAccessToken) {
    return {
      widgetId,
      status: 'requires_access_token',
      ready: false,
      requiresAccessToken,
      hasAccessToken,
      requiresOnlineAgent,
      hasOnlineAgent,
      reason: `${widgetId} widget requires agent.`
    }
  }

  if (requiresOnlineAgent && !hasOnlineAgent) {
    return {
      widgetId,
      status: 'agent_offline',
      ready: false,
      requiresAccessToken,
      hasAccessToken,
      requiresOnlineAgent,
      hasOnlineAgent,
      reason: `${widgetId} widget requires agent.`
    }
  }

  return {
    widgetId,
    status: 'ready',
    ready: true,
    requiresAccessToken,
    hasAccessToken,
    requiresOnlineAgent,
    hasOnlineAgent,
    reason: null
  }
}

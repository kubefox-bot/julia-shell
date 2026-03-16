import { TERMINAL_AGENT_WIDGET_ID, TRANSCRIBE_WIDGET_ID } from '@/widgets'
import type { PassportRequestContext } from '../context'
import { passportRuntime } from '../runtime/runtime'
import type { PassportWidgetProviderSnapshot } from '../types'
import { isPassportProtectedWidget } from './widget-policy'

function resolveRequiresOnlineAgent(widgetId: string) {
  return widgetId === TERMINAL_AGENT_WIDGET_ID || widgetId === TRANSCRIBE_WIDGET_ID
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
  const hasOnlineAgent = Boolean(passportRuntime.getOnlineAgentSession(context?.agentId))

  if (widgetId !== TRANSCRIBE_WIDGET_ID && widgetId !== TERMINAL_AGENT_WIDGET_ID) {
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

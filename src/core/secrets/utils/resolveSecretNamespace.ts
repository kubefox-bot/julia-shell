import type { SecretLookupContext } from '../types'
import { normalizeSecretNamespace } from './normalizeSecretNamespace'

export function resolveSecretNamespace(context?: SecretLookupContext) {
  if (context?.envName?.trim()) {
    return normalizeSecretNamespace(context.envName)
  }

  if (context?.widgetId?.trim()) {
    return normalizeSecretNamespace(context.widgetId)
  }

  return null
}

import type { AgentPlatform } from './types'

export function getDefaultPlatform(): AgentPlatform {
  if (typeof window === 'undefined') {
    return 'windows'
  }

  const source = window.navigator.userAgent.toLowerCase()
  if (source.includes('mac')) {
    return 'macos'
  }

  if (source.includes('linux')) {
    return 'linux'
  }

  return 'windows'
}

import type { WidgetManifest } from '../../entities/widget/model/types'

export const terminalAgentManifest: WidgetManifest = {
  id: 'com.yulia.terminal-agent',
  envName: 'terminal-agent',
  name: 'Terminal Agent',
  version: '1.0.0',
  description: 'Chat widget over runtime-agent for Codex and Gemini CLI.',
  headerName: {
    ru: 'Чат-агент',
    en: 'Agent Chat',
  },
  icon: '💬',
  ready: true,
  defaultSize: 'large',
  supportedSizes: ['medium', 'large'],
  capabilities: ['chat', 'sse', 'agent-runtime'],
  channels: ['bus', 'webhook', 'ws'],
}

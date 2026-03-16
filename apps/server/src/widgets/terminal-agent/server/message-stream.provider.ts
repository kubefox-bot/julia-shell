import type { TerminalAgentProvider } from '../../../domains/llm/server/repository/terminal-agent-repository'
import type { ProviderSettingsShape } from './message-stream.type'

const providerFieldMap: Record<TerminalAgentProvider, {
  apiKeyField: 'codexApiKey' | 'geminiApiKey'
  commandField: 'codexCommand' | 'geminiCommand'
  argsField: 'codexArgs' | 'geminiArgs'
  modelField: 'codexModel' | 'geminiModel'
}> = {
  codex: {
    apiKeyField: 'codexApiKey',
    commandField: 'codexCommand',
    argsField: 'codexArgs',
    modelField: 'codexModel',
  },
  gemini: {
    apiKeyField: 'geminiApiKey',
    commandField: 'geminiCommand',
    argsField: 'geminiArgs',
    modelField: 'geminiModel',
  },
}

function withModelArgs(baseArgs: string[], model: string) {
  const next = [...baseArgs]
  const trimmedModel = model.trim()
  if (!trimmedModel) {
    return next
  }

  const hasModelArg = next.some((entry, index) => {
    if (entry === '--model' || entry === '-m') {
      return true
    }
    return entry.startsWith('--model=') || (entry === '-m' && typeof next[index + 1] === 'string')
  })

  if (!hasModelArg) {
    next.push('--model', trimmedModel)
  }

  return next
}

function getProviderApiKey(provider: TerminalAgentProvider, settings: ProviderSettingsShape) {
  const fields = providerFieldMap[provider]
  return settings[fields.apiKeyField]
}

export function selectDispatchSettings(input: {
  provider: TerminalAgentProvider
  tokenSettings: ProviderSettingsShape
  onlineSettings: ProviderSettingsShape
}) {
  const candidates = [input.tokenSettings, input.onlineSettings, input.tokenSettings]
  return candidates.find((entry) => getProviderApiKey(input.provider, entry).trim()) ?? input.tokenSettings
}

export function getProviderDispatchConfig(provider: TerminalAgentProvider, settings: ProviderSettingsShape) {
  const fields = providerFieldMap[provider]
  return {
    apiKey: settings[fields.apiKeyField],
    commandPath: settings[fields.commandField],
    commandArgs: withModelArgs(settings[fields.argsField], settings[fields.modelField]),
  }
}

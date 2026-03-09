export type AppRuntimeEnv = {
  shellStatusPollIntervalMs: number
  passportHeartbeatTimeoutMs: number
  passportGrpcPort: number
  passportAgentDevModeEnabled: boolean
  passportProtocolProtoPath: string | null
  transcribeAgentMockModeEnabled: boolean
  geminiModel: string | null
  isDevelopment: boolean
}

export type AppPublicEnv = {
  agentReleasesBaseUrl: string
}

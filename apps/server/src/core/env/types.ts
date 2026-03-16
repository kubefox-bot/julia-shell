export type AppRuntimeEnv = {
  shellStatusPollIntervalMs: number
  passportHeartbeatTimeoutMs: number
  passportGrpcPort: number
  passportProtocolProtoPath: string | null
  geminiModel: string | null
  isDevelopment: boolean
}

export type AppPublicEnv = {
  agentReleasesBaseUrl: string
}

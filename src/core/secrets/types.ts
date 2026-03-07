export type SecretLookupContext = {
  widgetId?: string
  envName?: string | null
}

export type SecretSource = 'env' | 'infisical'

export type SecretResolution = {
  value: string
  source: SecretSource
  secretName: string
  envName: string | null
  secretPath: string | null
  reference: string | null
  editable: boolean
}

export interface SecretProvider {
  resolveSecret(key: string, context?: SecretLookupContext): Promise<SecretResolution | null>
}

export type InfisicalConfig = {
  clientId: string
  clientSecret: string
  projectId: string
  siteUrl?: string
}

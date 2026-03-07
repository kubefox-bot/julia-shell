export type InfisicalConfig = {
  projectId: string
  siteUrl?: string
  environment: string
  accessToken?: string
  clientId?: string
  clientSecret?: string
}

export type SecretEntry = {
  value: string
  source: 'infisical' | 'env'
  path: string | null
  reference: string | null
}

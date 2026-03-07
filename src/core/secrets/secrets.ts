import { EnvSecretProvider } from './providers/EnvSecretProvider'
import { InfisicalSecretProvider } from './providers/InfisicalSecretProvider'
import { SecretProviderChain } from './SecretProviderChain'
import { loadEnvFiles } from './utils/loadEnvFiles'

loadEnvFiles()

export const secrets = new SecretProviderChain([
  new InfisicalSecretProvider(),
  new EnvSecretProvider(),
])

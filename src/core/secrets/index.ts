import 'dotenv/config';
import { EnvSecretProvider, SecretProviderChain } from './provider';

export const secrets = new SecretProviderChain([
  new EnvSecretProvider()
]);

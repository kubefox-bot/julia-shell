export interface SecretProvider {
  getSecret(key: string): string | null;
}

export class EnvSecretProvider implements SecretProvider {
  getSecret(key: string) {
    const value = process.env[key];
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}

export class SecretProviderChain implements SecretProvider {
  constructor(private providers: SecretProvider[]) {}

  getSecret(key: string) {
    for (const provider of this.providers) {
      const value = provider.getSecret(key);
      if (value) {
        return value;
      }
    }
    return null;
  }
}

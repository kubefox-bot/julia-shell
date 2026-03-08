export function normalizeSecretPath(secretPath?: string | null) {
  if (!secretPath?.trim()) {
    return null
  }

  return `/${secretPath.trim()}`.replace(/\/+/g, '/')
}

export function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

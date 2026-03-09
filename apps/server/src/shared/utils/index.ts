export function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}
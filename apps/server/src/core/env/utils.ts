export function parseEnvInteger(value: string | undefined) {
  if (!value) {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }

  return Math.round(numeric)
}

export function clampInteger(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function parseEnvFlag(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized === '1' || normalized === 'true'
}

export function parseEnvString(value: string | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

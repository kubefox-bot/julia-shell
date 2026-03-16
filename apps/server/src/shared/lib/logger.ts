function isDevMode() {
  return import.meta.env.DEV
}

export const logger = {
  dev(...args: unknown[]) {
    if (!isDevMode()) {
      return
    }

    console.log(...args)
  },
  error(...args: unknown[]) {
    console.error(...args)
  },
}

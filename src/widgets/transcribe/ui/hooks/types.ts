export type LoadPathOptions = {
  allowEmpty?: boolean
  preserveSelection?: string[]
  silent?: boolean
}

export type UseTypewriterRevealOptions = {
  onChunk: (chunk: string) => void
  onComplete: () => void
}

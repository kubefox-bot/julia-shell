import { transcribeManifest } from './manifest'

export const TRANSCRIBE_WIDGET_META = {
  id: transcribeManifest.id,
  version: transcribeManifest.version,
} as const


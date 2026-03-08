import type { DisplayLocale } from '../../../../../entities/widget/model/types'
import type { SpeakerAliasEntry } from '../../model/types'

export type SpeakerTarget = {
  speakerKey: string
  speakerLabel: string
}

export type ResultViewProps = {
  locale: DisplayLocale
  theme: 'day' | 'night'
  resultText: string
  actionsLocked: boolean
  isTranscribing: boolean
  speakerAliases: Record<string, string>
  speakerAliasesSaving: boolean
  onBack: () => void
  onCopy: () => void
  onLoadSpeakerAliases: () => Promise<Record<string, string>>
  onSaveSpeakerAliases: (entries: SpeakerAliasEntry[]) => Promise<boolean>
  onSaveResult: (transcript: string) => Promise<boolean>
}

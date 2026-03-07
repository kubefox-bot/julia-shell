import { describe, expect, it } from 'vitest'
import { transcribeEn } from '../src/widgets/transcribe/i18n/en'
import { getPlatformLabel, getSecretSourceLabel, getTranscribeText } from '../src/widgets/transcribe/i18n'
import { transcribeRu } from '../src/widgets/transcribe/i18n/ru'

describe('transcribe i18n', () => {
  it('keeps ru and en dictionaries in sync', () => {
    expect(Object.keys(transcribeRu).sort()).toEqual(Object.keys(transcribeEn).sort())
  })

  it('returns locale-specific text', () => {
    expect(getTranscribeText('ru', 'buttonTranscribe')).toBe('Транскрибация')
    expect(getTranscribeText('en', 'buttonTranscribe')).toBe('Transcribe')
    expect(getPlatformLabel('ru', 'macos')).toBe('macOS')
    expect(getSecretSourceLabel('en', 'db')).toBe('Local DB')
  })
})

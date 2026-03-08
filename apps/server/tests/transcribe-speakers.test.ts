import { describe, expect, it } from 'vitest'
import {
  applySpeakerAliasesToTranscript,
  extractTranscriptSpeakers,
  normalizeSpeakerKey,
  normalizeTranscriptText
} from '../src/widgets/transcribe/ui/helpers'

describe('transcribe speaker helpers', () => {
  it('extracts unique speakers from [time] speaker separator lines', () => {
    const source = `
[01:45:06]   Спикер   2: Привет
[01:45:07] Спикер 1 — Hello
[01:45:08] Спикер 2: Еще раз
`
    expect(extractTranscriptSpeakers(source)).toEqual([
      { speakerKey: 'спикер 2', speakerLabel: 'Спикер   2' },
      { speakerKey: 'спикер 1', speakerLabel: 'Спикер 1' }
    ])
  })

  it('applies alias map to transcript lines with speaker format', () => {
    const source = `
[01:45:06] Спикер 2: Привет
[01:45:07] Спикер 1: Hello
Без таймкода: Спикер 3
`

    const result = applySpeakerAliasesToTranscript(source, {
      'спикер 2': 'Анна',
      'спикер 1': 'John'
    })

    expect(result).toContain('[01:45:06] Анна: Привет')
    expect(result).toContain('[01:45:07] John: Hello')
    expect(result).toContain('Без таймкода: Спикер 3')
  })

  it('normalizes timestamp newlines and speaker keys', () => {
    expect(normalizeTranscriptText('x [00:00:22] A')).toBe('x\n[00:00:22] A')
    expect(normalizeSpeakerKey('  Спикер   2 ')).toBe('спикер 2')
  })
})

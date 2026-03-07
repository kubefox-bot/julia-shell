import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { getTranscribeText } from '../../i18n'
import styles from '../TranscribeWidget.module.scss'
import type { DisplayLocale } from '../../../../entities/widget/model/types'
import { ActionButton } from './ActionButton'
import { BackGlyph, CloseGlyph, CopyGlyph, ExpandGlyph } from './TranscribeIcons'

type ResultViewProps = {
  locale: DisplayLocale
  theme: 'day' | 'night'
  resultText: string
  actionsLocked: boolean
  onBack: () => void
  onCopy: () => void
}

type SpeakerLineMatch = {
  prefix: string
  speaker: string
  separator: string
  rest: string
}

function matchSpeakerLine(line: string): SpeakerLineMatch | null {
  const match = line.match(/^(\s*(?:\[\d{2}:\d{2}:\d{2}\]\s*)?)((?:Спикер|Speaker)\b[^:\n—-]*)(\s*(?::|—|-)\s*)(.*)$/u)
  if (!match) {
    return null
  }

  const [, prefix, speaker, separator, rest] = match
  return { prefix, speaker, separator, rest }
}

export function ResultView(props: ResultViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [speakerAliases, setSpeakerAliases] = useState<Record<string, string>>({})
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null)
  const [speakerInputValue, setSpeakerInputValue] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fullscreenScrollRef = useRef<HTMLDivElement | null>(null)
  const speakerInputRef = useRef<HTMLInputElement | null>(null)

  const normalizedText = useMemo(() => {
    return props.resultText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]*((?:\[\d{2}:\d{2}:\d{2}\]))/g, '\n$1')
      .replace(/\n{3,}/g, '\n\n')
      .trimStart()
  }, [props.resultText])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    if (fullscreenScrollRef.current) {
      fullscreenScrollRef.current.scrollTop = fullscreenScrollRef.current.scrollHeight
    }
  }, [props.resultText])

  useEffect(() => {
    if (!editingSpeaker || !speakerInputRef.current) {
      return
    }

    speakerInputRef.current.focus()
    speakerInputRef.current.select()
  }, [editingSpeaker])

  useEffect(() => {
    if (!isFullscreen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isFullscreen])

  const onBack = () => {
    setIsFullscreen(false)
    props.onBack()
  }

  const commitSpeakerRename = () => {
    if (!editingSpeaker) {
      return
    }

    const nextValue = speakerInputValue.trim()
    setSpeakerAliases((current) => {
      if (!nextValue || nextValue === editingSpeaker) {
        const next = { ...current }
        delete next[editingSpeaker]
        return next
      }

      return { ...current, [editingSpeaker]: nextValue }
    })
    setEditingSpeaker(null)
  }

  const renderTranscriptBody = () => {
    const lines = normalizedText.split('\n')
    return (
      <>
        {lines.map((line, index) => {
          const match = matchSpeakerLine(line)
          if (!match) {
            return (
              <Fragment key={`${line}-${index}`}>
                {line}
                {index < lines.length - 1 ? '\n' : null}
              </Fragment>
            )
          }

          const { prefix, speaker, separator, rest } = match
          const alias = speakerAliases[speaker] ?? speaker
          const isEditing = editingSpeaker === speaker

          return (
            <Fragment key={`${speaker}-${index}`}>
              {prefix}
              {isEditing ? (
                <input
                  ref={speakerInputRef}
                  value={speakerInputValue}
                  className={styles.speakerRenameInput}
                  onChange={(event) => setSpeakerInputValue(event.currentTarget.value)}
                  onBlur={commitSpeakerRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitSpeakerRename()
                    }
                    if (event.key === 'Escape') {
                      setEditingSpeaker(null)
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={styles.speakerTag}
                  onDoubleClick={() => {
                    setEditingSpeaker(speaker)
                    setSpeakerInputValue(alias)
                  }}
                  title={getTranscribeText(props.locale, 'hintSpeakerRename')}
                >
                  {alias}
                </button>
              )}
              {separator}
              {rest}
              {index < lines.length - 1 ? '\n' : null}
            </Fragment>
          )
        })}
        {props.actionsLocked ? <span className={styles.resultCaret} aria-hidden="true" /> : null}
      </>
    )
  }

  return (
    <div className={styles.resultBlock}>
      <div ref={scrollRef} className={styles.resultText} aria-live="polite">
        <div className={styles.resultTextBody}>{renderTranscriptBody()}</div>
      </div>
      <div className={styles.resultActions}>
        <ActionButton type="button" theme={props.theme} tone="secondary" icon={<BackGlyph />} onClick={onBack} disabled={props.actionsLocked}>
          {getTranscribeText(props.locale, 'buttonBack')}
        </ActionButton>
        <ActionButton type="button" theme={props.theme} tone="secondary" icon={<ExpandGlyph />} onClick={() => setIsFullscreen(true)} disabled={!props.resultText}>
          {getTranscribeText(props.locale, 'buttonExpandResult')}
        </ActionButton>
        <ActionButton type="button" theme={props.theme} icon={<CopyGlyph />} onClick={props.onCopy} disabled={props.actionsLocked || !props.resultText}>
          {getTranscribeText(props.locale, 'buttonCopy')}
        </ActionButton>
      </div>
      {isFullscreen ? (
        <div className={styles.resultFullscreenOverlay} role="dialog" aria-modal="true">
          <div className={[styles.resultFullscreenModal, props.theme === 'night' ? styles.resultFullscreenModalNight : ''].join(' ').trim()}>
            <div className={styles.resultFullscreenHeader}>
              <h4>{getTranscribeText(props.locale, 'titleResultFullscreen')}</h4>
              <button
                type="button"
                className={styles.resultFullscreenClose}
                onClick={() => setIsFullscreen(false)}
                aria-label={getTranscribeText(props.locale, 'buttonCloseFullscreen')}
              >
                <CloseGlyph />
              </button>
            </div>
            <div ref={fullscreenScrollRef} className={[styles.resultText, styles.resultTextFullscreen].join(' ')} aria-live="polite">
              <div className={styles.resultTextBody}>{renderTranscriptBody()}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

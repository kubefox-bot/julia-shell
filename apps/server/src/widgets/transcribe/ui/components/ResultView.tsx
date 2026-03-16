import { useEffect, useMemo, useState } from 'react'
import { applySpeakerAliasesToTranscript, extractTranscriptSpeakers, normalizeTranscriptText } from '../helpers'
import styles from '../TranscribeWidget.module.css'
import { ResultActionsBar } from './result/ResultActionsBar'
import { ResultFullscreenModal } from './result/ResultFullscreenModal'
import { ResultTranscriptPanel } from './result/ResultTranscriptPanel'
import { SpeakerAliasesModal } from './result/SpeakerAliasesModal'
import type { ResultViewProps } from './result/types'

export function ResultView(props: ResultViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [speakerModalOpen, setSpeakerModalOpen] = useState(false)
  const [speakerDraft, setSpeakerDraft] = useState<Record<string, string>>({})

  const normalizedText = useMemo(() => normalizeTranscriptText(props.resultText), [props.resultText])
  const speakerTargets = useMemo(() => extractTranscriptSpeakers(normalizedText), [normalizedText])
  const visibleText = useMemo(
    () => applySpeakerAliasesToTranscript(normalizedText, props.speakerAliases),
    [normalizedText, props.speakerAliases]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (isFullscreen) {
        setIsFullscreen(false)
        return
      }

      if (speakerModalOpen) {
        setSpeakerModalOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isFullscreen, speakerModalOpen])

  const onBack = () => {
    setIsFullscreen(false)
    setSpeakerModalOpen(false)
    props.onBack()
  }

  const openSpeakerModal = async () => {
    const latestAliases = await props.onLoadSpeakerAliases()
    const nextDraft: Record<string, string> = {}

    for (const target of speakerTargets) {
      nextDraft[target.speakerKey] = latestAliases[target.speakerKey] ?? props.speakerAliases[target.speakerKey] ?? ''
    }

    setSpeakerDraft(nextDraft)
    setSpeakerModalOpen(true)
  }

  const onSaveSpeakerAliases = async () => {
    const payload = speakerTargets.map((target) => ({
      speakerKey: target.speakerKey,
      aliasName: speakerDraft[target.speakerKey] ?? ''
    }))

    const success = await props.onSaveSpeakerAliases(payload)
    if (success) {
      setSpeakerModalOpen(false)
    }
  }

  const isActionsDisabled = props.actionsLocked || props.isTranscribing

  return (
    <div className={styles.resultBlock}>
      <ResultTranscriptPanel text={visibleText} actionsLocked={props.actionsLocked} />
      <ResultActionsBar
        locale={props.locale}
        theme={props.theme}
        resultText={props.resultText}
        visibleText={visibleText}
        isActionsDisabled={isActionsDisabled}
        onBack={onBack}
        onOpenSpeakerAliases={() => void openSpeakerModal()}
        onExpand={() => setIsFullscreen(true)}
        onCopy={props.onCopy}
        onSaveResult={(transcript) => {
          void props.onSaveResult(transcript)
        }}
      />

      {speakerModalOpen ? (
        <SpeakerAliasesModal
          locale={props.locale}
          theme={props.theme}
          isTranscribing={props.isTranscribing}
          speakerAliasesSaving={props.speakerAliasesSaving}
          speakerTargets={speakerTargets}
          speakerDraft={speakerDraft}
          onSpeakerDraftChange={(speakerKey, value) => {
            setSpeakerDraft((current) => ({
              ...current,
              [speakerKey]: value
            }))
          }}
          onClose={() => setSpeakerModalOpen(false)}
          onSave={() => void onSaveSpeakerAliases()}
        />
      ) : null}

      {isFullscreen ? (
        <ResultFullscreenModal
          locale={props.locale}
          theme={props.theme}
          visibleText={visibleText}
          actionsLocked={props.actionsLocked}
          isActionsDisabled={isActionsDisabled}
          onClose={() => setIsFullscreen(false)}
        />
      ) : null}
    </div>
  )
}

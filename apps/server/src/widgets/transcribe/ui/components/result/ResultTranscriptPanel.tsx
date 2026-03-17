import { useEffect, useRef } from 'react'
import styles from '../../TranscribeWidget.module.css'

type ResultTranscriptPanelProps = {
  text: string
  actionsLocked: boolean
  className?: string
}

export function ResultTranscriptPanel(props: ResultTranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const { text } = props

  useEffect(() => {
    void text
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [text])

  return (
    <div ref={scrollRef} className={props.className ?? styles.resultText} aria-live="polite">
      <div className={styles.resultTextBody}>
        {props.text}
        {props.actionsLocked ? <span className={styles.resultCaret} aria-hidden="true" /> : null}
      </div>
    </div>
  )
}

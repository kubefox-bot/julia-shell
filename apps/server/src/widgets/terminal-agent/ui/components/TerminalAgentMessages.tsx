import type { MessageItem, RetryState } from '../terminal-agent.types'
import type { TerminalAgentDictionary } from '../terminal-agent.dictionary'
import { RetryGlyph } from '../terminal-agent.icons'

type Props = {
  messages: MessageItem[]
  sending: boolean
  retryState: RetryState | null
  t: TerminalAgentDictionary
  styles: Record<string, string>
  onRetry: (payload: RetryState) => void
}

export function TerminalAgentMessages(props: Props) {
  const { messages, sending, retryState, t, styles, onRetry } = props

  return (
    <div className={styles.chatList}>
      {messages.map((entry) => {
        const canRetry = entry.role === 'user' && retryState?.userMessageId === entry.id
        const articleClassName = [
          styles.bubble,
          entry.role === 'user' ? styles.user : styles.assistant,
          canRetry ? styles.retryTarget : '',
        ].join(' ').trim()

        return (
          <article key={entry.id} className={articleClassName}>
            {entry.text ? entry.text : entry.role === 'assistant' && sending ? (
              <output className={styles.typingIndicator} aria-live="polite" aria-label={t.sending}>
                <span />
                <span />
                <span />
              </output>
            ) : ''}
            {canRetry ? (
              <button
                type="button"
                className={styles.retryInlineButton}
                aria-label={t.retry}
                title={t.retry}
                onClick={() => onRetry(retryState)}
                disabled={sending}
              >
                <RetryGlyph />
              </button>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

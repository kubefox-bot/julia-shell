import { ModelGlyph } from '../terminal-agent.icons'
import type { TerminalAgentDictionary } from '../terminal-agent.dictionary'

type Props = {
  input: string
  sending: boolean
  styles: Record<string, string>
  actionThemeClass: string
  t: TerminalAgentDictionary
  modelLine: string
  onInputChange: (value: string) => void
  onSubmit: () => void
}

export function TerminalAgentComposer(props: Props) {
  return (
    <form
      className={props.styles.composer}
      onSubmit={(event) => {
        event.preventDefault()
        props.onSubmit()
      }}
    >
      <textarea
        value={props.input}
        onChange={(event) => props.onInputChange(event.target.value)}
        placeholder={props.t.placeholder}
        rows={3}
        disabled={props.sending}
      />
      <span className={props.styles.sendModelInfo}>{props.modelLine}</span>
      <button
        type="submit"
        className={[props.styles.actionButton, props.styles.actionButtonPrimary, props.actionThemeClass].join(' ').trim()}
        disabled={props.sending || !props.input.trim()}
      >
        <span className={props.styles.actionButtonIcon}><ModelGlyph /></span>
        <span>{props.sending ? props.t.sending : props.t.send}</span>
      </button>
    </form>
  )
}

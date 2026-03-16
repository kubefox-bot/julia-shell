import { IconCircle } from '@shared/ui/IconCircle'
import { AgentWrenchGlyph, DialogsGlyph, NewDialogGlyph } from '../terminal-agent.icons'
import type { TerminalAgentDictionary } from '../terminal-agent.dictionary'

type Props = {
  theme: 'day' | 'night'
  t: TerminalAgentDictionary
  styles: Record<string, string>
  actionThemeClass: string
  localizedStatus: string
  resumeLabel: string
  onNewDialog: () => void
  onOpenDialogs: () => void
  onOpenSettings: () => void
}

export function TerminalAgentToolbar(props: Props) {
  return (
    <div className={props.styles.toolbar}>
      <div className={props.styles.meta}>
        <span>{props.t.status}: {props.localizedStatus}</span>
        <span>{props.t.resumeRef}: {props.resumeLabel}</span>
      </div>
      <div className={props.styles.actions}>
        <button
          type="button"
          className={[props.styles.actionButton, props.styles.actionButtonSecondary, props.actionThemeClass].join(' ').trim()}
          onClick={props.onNewDialog}
        >
          <span className={props.styles.actionButtonIcon}><NewDialogGlyph /></span>
          <span>{props.t.newDialog}</span>
        </button>
        <button
          type="button"
          className={[props.styles.actionButton, props.styles.actionButtonSecondary, props.actionThemeClass].join(' ').trim()}
          onClick={props.onOpenDialogs}
        >
          <span className={props.styles.actionButtonIcon}><DialogsGlyph /></span>
          <span>{props.t.dialogs}</span>
        </button>
        <IconCircle type="button" theme={props.theme} title={props.t.settings} onClick={props.onOpenSettings}>
          <AgentWrenchGlyph />
        </IconCircle>
      </div>
    </div>
  )
}

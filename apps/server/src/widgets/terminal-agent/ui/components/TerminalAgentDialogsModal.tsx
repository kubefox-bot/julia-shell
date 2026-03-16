import { DateTime } from 'luxon'
import { Button } from '@shared/ui/Button'
import { IconCircle } from '@shared/ui/IconCircle'
import { ModalSurface } from '@shared/ui/ModalSurface'
import type { TerminalAgentDictionary } from '../terminal-agent.dictionary'
import type { DialogRefItem } from '../terminal-agent.types'

type Props = {
  open: boolean
  theme: 'day' | 'night'
  styles: Record<string, string>
  t: TerminalAgentDictionary
  dialogsLoading: boolean
  dialogRefs: DialogRefItem[]
  selectedDialogRef: string
  onClose: () => void
  onSelectRef: (value: string) => void
  onAccept: () => void
}

export function TerminalAgentDialogsModal(props: Props) {
  if (!props.open) {
    return null
  }

  return (
    <ModalSurface
      open={props.open}
      onClose={props.onClose}
      ariaLabel={props.t.selectDialog}
      theme={props.theme}
      panelClassName={props.styles.dialogsPanel}
    >
      <div className={props.styles.settingsHeader}>
        <h4>{props.t.selectDialog}</h4>
        <IconCircle type="button" theme={props.theme} title={props.t.cancel} onClick={props.onClose}>✕</IconCircle>
      </div>
      <div className={props.styles.dialogsTableWrap}>
        <table className={props.styles.dialogsTable}>
          <thead>
            <tr>
              <th>{props.t.dialogIdCol}</th>
              <th>{props.t.dialogCreatedCol}</th>
              <th>{props.t.dialogStatusCol}</th>
            </tr>
          </thead>
          <tbody>
            {props.dialogRefs.length === 0 ? (
              <tr>
                <td colSpan={3}>{props.dialogsLoading ? props.t.sending : props.t.emptyDialogs}</td>
              </tr>
            ) : props.dialogRefs.map((item) => (
              <tr
                key={item.providerSessionRef}
                className={props.selectedDialogRef === item.providerSessionRef ? props.styles.dialogRowActive : ''}
                onClick={() => props.onSelectRef(item.providerSessionRef)}
              >
                <td>{item.dialogTitle || item.providerSessionRef}</td>
                <td>{DateTime.fromISO(item.createdAt).toLocaleString(DateTime.DATETIME_SHORT)}</td>
                <td>{item.lastStatus || 'done'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={props.styles.settingsActions}>
        <Button type="button" variant="ghost" onClick={props.onClose}>{props.t.cancel}</Button>
        <Button type="button" className={props.styles.acceptButton} onClick={props.onAccept} disabled={!props.selectedDialogRef}>
          {props.t.accept}
        </Button>
      </div>
    </ModalSurface>
  )
}

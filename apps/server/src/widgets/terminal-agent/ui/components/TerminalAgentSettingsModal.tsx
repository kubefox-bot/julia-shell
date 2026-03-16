import { Button } from '@shared/ui/Button'
import { IconCircle } from '@shared/ui/IconCircle'
import { ModalSurface } from '@shared/ui/ModalSurface'
import { OptionSelect } from '@shared/ui/OptionSelect'
import type { TerminalAgentDictionary } from '../terminal-agent.dictionary'
import type { Provider, SettingsPayload } from '../terminal-agent.types'
import { parseArgsInput } from '../terminal-agent.utils'

type Props = {
  open: boolean
  theme: 'day' | 'night'
  styles: Record<string, string>
  t: TerminalAgentDictionary
  settings: SettingsPayload | null
  providerOptions: Array<{ value: Provider; label: string }>
  codexModelOptions: Array<{ value: string; label: string }>
  geminiModelOptions: Array<{ value: string; label: string }>
  onClose: () => void
  onSave: () => void
  onSettingsChange: (update: (current: SettingsPayload) => SettingsPayload) => void
  onProviderChange: (provider: Provider) => void
}

export function TerminalAgentSettingsModal(props: Props) {
  if (!props.open || !props.settings) {
    return null
  }

  const { settings } = props

  return (
    <ModalSurface
      open={props.open}
      onClose={props.onClose}
      ariaLabel={props.t.settings}
      theme={props.theme}
      panelClassName={props.styles.settingsPanel}
    >
      <div className={props.styles.settingsHeader}>
        <h4>{props.t.settingsTitle}</h4>
        <IconCircle type="button" theme={props.theme} title={props.t.close} onClick={props.onClose}>✕</IconCircle>
      </div>
      <div className={props.styles.field}>
        {props.t.provider}
        <OptionSelect
          theme={props.theme}
          value={settings.activeProvider}
          options={props.providerOptions}
          onChange={(value) => props.onProviderChange(value === 'gemini' ? 'gemini' : 'codex')}
        />
      </div>

      {settings.activeProvider === 'codex' ? (
        <>
          <label>
            {props.t.codexKey}
            <input value={settings.codexApiKey} onChange={(event) => props.onSettingsChange((current) => ({ ...current, codexApiKey: event.target.value }))} />
          </label>
          <label>
            {props.t.codexCommand}
            <input value={settings.codexCommand} onChange={(event) => props.onSettingsChange((current) => ({ ...current, codexCommand: event.target.value }))} />
          </label>
          <label>
            {props.t.codexArgs}
            <input value={settings.codexArgs.join(' ')} onChange={(event) => props.onSettingsChange((current) => ({ ...current, codexArgs: parseArgsInput(event.target.value) }))} />
          </label>
          <div className={props.styles.field}>
            {props.t.codexModel}
            <OptionSelect
              theme={props.theme}
              value={settings.codexModel}
              options={props.codexModelOptions}
              onChange={(value) => props.onSettingsChange((current) => ({ ...current, codexModel: value }))}
            />
          </div>
        </>
      ) : (
        <>
          <label>
            {props.t.geminiKey}
            <input value={settings.geminiApiKey} onChange={(event) => props.onSettingsChange((current) => ({ ...current, geminiApiKey: event.target.value }))} />
          </label>
          <label>
            {props.t.geminiCommand}
            <input value={settings.geminiCommand} onChange={(event) => props.onSettingsChange((current) => ({ ...current, geminiCommand: event.target.value }))} />
          </label>
          <label>
            {props.t.geminiArgs}
            <input value={settings.geminiArgs.join(' ')} onChange={(event) => props.onSettingsChange((current) => ({ ...current, geminiArgs: parseArgsInput(event.target.value) }))} />
          </label>
          <div className={props.styles.field}>
            {props.t.geminiModel}
            <OptionSelect
              theme={props.theme}
              value={settings.geminiModel}
              options={props.geminiModelOptions}
              onChange={(value) => props.onSettingsChange((current) => ({ ...current, geminiModel: value }))}
            />
          </div>
        </>
      )}

      <label className={props.styles.checkboxRow}>
        <input
          type="checkbox"
          checked={settings.useShellFallback}
          onChange={(event) => props.onSettingsChange((current) => ({ ...current, useShellFallback: event.target.checked }))}
        />
        <span>{props.t.shellFallback}</span>
      </label>
      <label>
        {props.t.shellOverride}
        <input value={settings.shellOverride} onChange={(event) => props.onSettingsChange((current) => ({ ...current, shellOverride: event.target.value }))} />
      </label>

      <div className={props.styles.settingsActions}>
        <Button type="button" variant="ghost" onClick={props.onClose}>{props.t.close}</Button>
        <Button type="button" onClick={props.onSave}>{props.t.save}</Button>
      </div>
    </ModalSurface>
  )
}

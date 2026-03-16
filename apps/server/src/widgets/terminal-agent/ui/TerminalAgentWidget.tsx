import type { WidgetRenderProps } from '../../../entities/widget/model/types'
import { terminalAgentDictionary } from './terminal-agent.dictionary'
import {
  resolveActionThemeClass,
  resolveActiveModel,
  resolveDisplayError,
  resolveLocalizedStatus,
  resolveModelLine,
  resolveThemeClass,
} from './terminal-agent.resolvers'
import { useTerminalAgentController } from './hooks'
import {
  TerminalAgentComposer,
  TerminalAgentDialogsModal,
  TerminalAgentMessages,
  TerminalAgentSettingsModal,
  TerminalAgentToolbar,
} from './components'
import styles from './TerminalAgentWidget.module.scss'

export function TerminalAgentWidget(props: WidgetRenderProps) {
  const t = terminalAgentDictionary[props.locale]
  const controller = useTerminalAgentController(props)
  const themeClass = resolveThemeClass(props.theme)
  const actionThemeClass = resolveActionThemeClass(props.theme)
  const localizedStatus = resolveLocalizedStatus(controller.statusLine, t)
  const displayError = resolveDisplayError(controller.error, t)
  const activeModel = resolveActiveModel(controller.settings, controller.activeProvider)
  const modelLine = resolveModelLine({
    locale: props.locale,
    provider: controller.activeProvider,
    activeModel,
  })
  const resumeLabel = controller.dialogState?.dialogTitle || controller.dialogState?.providerSessionRef || '—'

  return (
    <div className={[styles.root, themeClass].join(' ')}>
      <TerminalAgentToolbar
        theme={props.theme}
        t={t}
        styles={styles}
        actionThemeClass={actionThemeClass}
        localizedStatus={localizedStatus}
        resumeLabel={resumeLabel}
        onNewDialog={() => void controller.createNewDialog()}
        onOpenDialogs={() => void controller.openDialogs()}
        onOpenSettings={() => controller.setSettingsOpen(true)}
      />

      {displayError ? <p className={styles.error}>{displayError}</p> : null}
      {controller.resumeFailed ? <p className={styles.warning}>{t.resumeFailed}</p> : null}

      <TerminalAgentMessages
        messages={controller.messages}
        sending={controller.sending}
        retryState={controller.retryState}
        t={t}
        styles={styles}
        onRetry={(payload) => {
          void controller.sendMessage({
            message: payload.message,
            appendUser: false,
            userMessageId: payload.userMessageId,
          })
        }}
      />

      <TerminalAgentComposer
        input={controller.input}
        sending={controller.sending}
        styles={styles}
        actionThemeClass={actionThemeClass}
        t={t}
        modelLine={modelLine}
        onInputChange={controller.setInput}
        onSubmit={() => {
          void controller.sendMessage()
        }}
      />

      <TerminalAgentSettingsModal
        open={controller.settingsOpen}
        theme={props.theme}
        styles={styles}
        t={t}
        settings={controller.settings}
        providerOptions={controller.providerOptions}
        codexModelOptions={controller.codexModelOptions}
        geminiModelOptions={controller.geminiModelOptions}
        onClose={() => controller.setSettingsOpen(false)}
        onSave={() => {
          void controller.saveSettings()
        }}
        onSettingsChange={(update) => {
          controller.setSettings((current) => (current ? update(current) : current))
        }}
        onProviderChange={(provider) => {
          controller.setSettings((current) => (current ? { ...current, activeProvider: provider } : current))
          void controller.loadDialogState(provider)
          void controller.loadModels(provider).catch(() => {
            // keep fallback options
          })
        }}
      />

      <TerminalAgentDialogsModal
        open={controller.dialogsOpen}
        theme={props.theme}
        styles={styles}
        t={t}
        dialogsLoading={controller.dialogsLoading}
        dialogRefs={controller.dialogRefs}
        selectedDialogRef={controller.selectedDialogRef}
        onClose={() => controller.setDialogsOpen(false)}
        onSelectRef={controller.setSelectedDialogRef}
        onAccept={() => {
          void controller.selectDialog()
        }}
      />
    </div>
  )
}

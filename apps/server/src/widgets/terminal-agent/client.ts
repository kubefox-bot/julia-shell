import type { WidgetClientModule } from '../../entities/widget/model/types'
import { defineWidgetClientModule } from '../../entities/widget/model/define-widget'
import { terminalAgentManifest } from './manifest'
import { TerminalAgentWidget } from './ui/TerminalAgentWidget'

export function registerClientWidget(): WidgetClientModule {
  return defineWidgetClientModule({
    manifest: terminalAgentManifest,
    Render: TerminalAgentWidget,
  })
}

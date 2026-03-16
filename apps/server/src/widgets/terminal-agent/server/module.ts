import type { WidgetServerModule } from '../../../entities/widget/model/types'
import { terminalAgentHandlers } from './handlers'

export const terminalAgentServerModule: WidgetServerModule = {
  init: async () => ({ ready: true }),
  handlers: terminalAgentHandlers,
}

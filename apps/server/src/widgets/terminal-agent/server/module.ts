import { passportRuntime } from '@passport/server/runtime'
import type { WidgetServerModule } from '../../../entities/widget/model/types'
import { WIDGET_ID } from './constants'
import { terminalAgentHandlers } from './handlers'

export const terminalAgentServerModule: WidgetServerModule = {
  init: async () => {
    const onlineAgent = passportRuntime.getOnlineAgentSession()
    if (!onlineAgent) {
      return {
        ready: false,
        reason: `${WIDGET_ID} widget requires agent.`,
      }
    }

    return { ready: true }
  },
  handlers: terminalAgentHandlers,
}

import type { RegisteredWidgetModule } from '../../entities/widget/model/types'
import { registerClientWidget } from './client'

export function registerWidget(): RegisteredWidgetModule {
  return {
    ...registerClientWidget(),
    loadServerModule: async () => {
      const module = await import('./server/module')
      return module.terminalAgentServerModule
    },
  }
}

import type { WidgetClientModule } from '../../entities/widget/model/types';

type ClientDiscoveredModule = {
  registerClientWidget?: () => WidgetClientModule;
};

const discoveredModules = import.meta.glob<ClientDiscoveredModule>('../../widgets/*/client.ts', {
  eager: true
});

export function listClientWidgetModules() {
  const modules: WidgetClientModule[] = [];

  for (const moduleValue of Object.values(discoveredModules)) {
    if (typeof moduleValue.registerClientWidget !== 'function') {
      continue;
    }

    modules.push(moduleValue.registerClientWidget());
  }

  return modules;
}

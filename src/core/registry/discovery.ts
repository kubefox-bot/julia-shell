import { validateWidgetManifest } from '../../entities/widget/model/validate-manifest';
import type { RegisteredWidgetModule, WidgetDescriptor, WidgetRuntimeState } from '../../entities/widget/model/types';

type DiscoveredModule = {
  registerWidget?: () => RegisteredWidgetModule;
};

const discoveredModules = import.meta.glob<DiscoveredModule>('../../widgets/*/register.ts', {
  eager: true
});

function normalizeRegisteredModule(moduleValue: DiscoveredModule) {
  if (typeof moduleValue.registerWidget === 'function') {
    return moduleValue.registerWidget();
  }

  return null;
}

export async function discoverWidgets(): Promise<WidgetDescriptor[]> {
  const registeredModules: RegisteredWidgetModule[] = [];

  for (const moduleValue of Object.values(discoveredModules)) {
    const registeredModule = normalizeRegisteredModule(moduleValue);
    if (!registeredModule) continue;
    registeredModules.push(registeredModule);
  }

  const idCounts = new Map<string, number>();
  for (const registeredModule of registeredModules) {
    const current = idCounts.get(registeredModule.manifest.id) ?? 0;
    idCounts.set(registeredModule.manifest.id, current + 1);
  }

  const widgets: WidgetDescriptor[] = [];

  for (const registeredModule of registeredModules) {
    const reasons = validateWidgetManifest(registeredModule.manifest);

    if (!registeredModule.manifest.ready) {
      reasons.push('manifest.ready is false.');
    }

    if ((idCounts.get(registeredModule.manifest.id) ?? 0) > 1) {
      reasons.push(`Duplicate widget id: ${registeredModule.manifest.id}`);
    }

    try {
      const serverModule = await registeredModule.loadServerModule();
      if (serverModule.init) {
        const initResult = await serverModule.init();
        if (initResult && initResult.ready === false) {
          reasons.push(initResult.reason?.trim() || 'init() returned not ready.');
        }
      }
    } catch (error) {
      reasons.push(error instanceof Error ? error.message : 'loadServerModule() failed.');
    }

    const runtime: WidgetRuntimeState = {
      ready: reasons.length === 0,
      notReadyReasons: reasons
    };

    widgets.push({
      module: registeredModule,
      runtime
    });
  }

  return widgets;
}

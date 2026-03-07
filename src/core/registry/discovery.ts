import { validateWidgetManifest } from '../../entities/widget/model/validate-manifest';
import type { WidgetRuntimeState, WidgetServerPlugin } from '../../entities/widget/model/types';

type DiscoveredModule = {
  default?: WidgetServerPlugin;
  plugin?: WidgetServerPlugin;
};

export type DiscoveredWidget = {
  plugin: WidgetServerPlugin;
  runtime: WidgetRuntimeState;
};

const discoveredModules = import.meta.glob<DiscoveredModule>('../../widgets/*/server/plugin.ts', {
  eager: true
});

function normalizePlugin(moduleValue: DiscoveredModule) {
  if (moduleValue.default) return moduleValue.default;
  if (moduleValue.plugin) return moduleValue.plugin;
  return null;
}

export async function discoverWidgets(): Promise<DiscoveredWidget[]> {
  const plugins: WidgetServerPlugin[] = [];

  for (const moduleValue of Object.values(discoveredModules)) {
    const plugin = normalizePlugin(moduleValue);
    if (!plugin) continue;
    plugins.push(plugin);
  }

  const idCounts = new Map<string, number>();
  for (const plugin of plugins) {
    const current = idCounts.get(plugin.manifest.widgetId) ?? 0;
    idCounts.set(plugin.manifest.widgetId, current + 1);
  }

  const widgets: DiscoveredWidget[] = [];

  for (const plugin of plugins) {
    const reasons = validateWidgetManifest(plugin.manifest);

    if (!plugin.manifest.ready) {
      reasons.push('manifest.ready is false.');
    }

    if ((idCounts.get(plugin.manifest.widgetId) ?? 0) > 1) {
      reasons.push(`Duplicate widgetId: ${plugin.manifest.widgetId}`);
    }

    if (plugin.init) {
      try {
        const initResult = await plugin.init();
        if (initResult && initResult.ready === false) {
          reasons.push(initResult.reason?.trim() || 'init() returned not ready.');
        }
      } catch (error) {
        reasons.push(error instanceof Error ? error.message : 'init() failed.');
      }
    }

    widgets.push({
      plugin,
      runtime: {
        ready: reasons.length === 0,
        notReadyReasons: reasons
      }
    });
  }

  return widgets;
}

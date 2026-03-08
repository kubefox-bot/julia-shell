import { listClientWidgetModules } from '../../../core/registry/client-registry';
import type { ShellRegistryEntry } from '../model/types';

const clientModules = listClientWidgetModules();
const clientModuleMap = new Map(
  clientModules.map((module) => [
    module.manifest.id,
    {
      widgetId: module.manifest.id,
      Icon: module.Icon,
      Render: module.Render
    } satisfies ShellRegistryEntry
  ])
);

export function useShellRegistry() {
  return {
    clientModules,
    clientModuleMap
  };
}

export function getShellRegistryEntry(widgetId: string) {
  return clientModuleMap.get(widgetId) ?? null;
}

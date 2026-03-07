import type { LayoutItem, WidgetClientModule, WidgetModuleInfo } from '../../../entities/widget/model/types';
import { getVisibleLayout, getVisibleWidgetIds, normalizeLayout } from './layout';

export function buildShellSkeletonLayout(
  layout: LayoutItem[],
  modules: WidgetModuleInfo[],
  registryModules: WidgetClientModule[]
) {
  if (modules.length > 0) {
    return getVisibleLayout(normalizeLayout(layout, modules), getVisibleWidgetIds(modules));
  }

  return registryModules
    .filter((module) => module.manifest.ready)
    .map((module, index) => ({
      widgetId: module.manifest.id,
      order: index,
      size: module.manifest.defaultSize
    }));
}

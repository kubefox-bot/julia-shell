import { WIDGET_SIZE_SET } from '@/entities/widget/model';
import type { LayoutItem, WidgetModuleInfo } from '@/entities/widget/model/types';
import type { PreviewLayoutEntry } from './types';

export function normalizeLayout(layout: LayoutItem[], modules: WidgetModuleInfo[]) {
  const moduleMap = new Map(modules.map((module) => [module.id, module]));
  const seen = new Set<string>();

  const base = layout
    .filter((item) => {
      if (!moduleMap.has(item.widgetId)) return false;
      if (seen.has(item.widgetId)) return false;
      if (!WIDGET_SIZE_SET.has(item.size)) return false;
      seen.add(item.widgetId);
      return true;
    })
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));

  for (const module of modules) {
    if (!seen.has(module.id)) {
      base.push({
        widgetId: module.id,
        order: base.length,
        size: module.defaultSize
      });
    }
  }

  return base;
}

export function getVisibleWidgetIds(modules: WidgetModuleInfo[]) {
  return modules.filter((module) => module.ready && module.enabled).map((module) => module.id);
}

export function getVisibleLayout(items: LayoutItem[], visibleWidgetIds: string[]) {
  const allowed = new Set(visibleWidgetIds);
  return items
    .filter((item) => allowed.has(item.widgetId))
    .sort((a, b) => a.order - b.order);
}

export function buildPreviewLayout(
  items: LayoutItem[],
  activeId: string | null,
  overId: string | null
): PreviewLayoutEntry[] {
  if (!activeId) {
    return items.map((item) => ({ kind: 'widget', item }));
  }

  const activeItem = items.find((item) => item.widgetId === activeId);
  if (!activeItem) {
    return items.map((item) => ({ kind: 'widget', item }));
  }

  const withoutActive = items.filter((item) => item.widgetId !== activeId);
  const targetIndex = overId
    ? withoutActive.findIndex((item) => item.widgetId === overId)
    : withoutActive.length;
  const insertionIndex = targetIndex >= 0 ? targetIndex : withoutActive.length;

  return [
    ...withoutActive.slice(0, insertionIndex).map((item) => ({ kind: 'widget' as const, item })),
    { kind: 'placeholder' as const, item: activeItem },
    ...withoutActive.slice(insertionIndex).map((item) => ({ kind: 'widget' as const, item }))
  ];
}

export function mergeVisibleAndHiddenLayout(currentDraftLayout: LayoutItem[], nextVisible: LayoutItem[]) {
  const nextVisibleMap = new Map(nextVisible.map((item, index) => [item.widgetId, { ...item, order: index }]));
  const hidden = currentDraftLayout
    .filter((item) => !nextVisibleMap.has(item.widgetId))
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: nextVisible.length + index }));

  return [...nextVisible.map((item, index) => ({ ...item, order: index })), ...hidden];
}

export function reorderVisibleLayout(
  currentDraftLayout: LayoutItem[],
  visibleLayout: LayoutItem[],
  activeId: string,
  overId: string | null
) {
  if (!overId || activeId === overId) {
    return currentDraftLayout;
  }

  const ids = visibleLayout.map((item) => item.widgetId);
  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);

  if (oldIndex < 0 || newIndex < 0) {
    return currentDraftLayout;
  }

  const reorderedVisible = [...visibleLayout];
  const [activeItem] = reorderedVisible.splice(oldIndex, 1);

  if (!activeItem) {
    return currentDraftLayout;
  }

  reorderedVisible.splice(newIndex, 0, activeItem);

  return mergeVisibleAndHiddenLayout(
    currentDraftLayout,
    reorderedVisible.map((item, index) => ({
      ...item,
      order: index
    }))
  );
}

export function hasUnsavedLayoutChanges(layout: LayoutItem[], draftLayout: LayoutItem[]) {
  return JSON.stringify(layout) !== JSON.stringify(draftLayout);
}

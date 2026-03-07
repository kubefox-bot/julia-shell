import { useMemo } from 'react';
import type { WidgetModuleInfo } from '../../../entities/widget/model/types';
import { resolveDisplayLocale } from '../../../shared/lib/locale';
import { buildPreviewLayout, getVisibleLayout, getVisibleWidgetIds, hasUnsavedLayoutChanges } from './layout';
import { useShellStore } from './store';
import type { ShellLayoutViewModel } from './types';

export function useShellLoadingState() {
  const loading = useShellStore((state) => state.loading);
  const error = useShellStore((state) => state.error);
  return { loading, error };
}

export function useShellLocale() {
  const browserLocale = useShellStore((state) => state.browserLocale);
  const locale = useShellStore((state) => state.layoutSettings.locale);

  return useMemo(
    () => resolveDisplayLocale(locale, browserLocale),
    [browserLocale, locale]
  );
}

export function useShellEditMode() {
  return useShellStore((state) => state.isEditMode);
}

export function useShellModuleInfo(widgetId: string): WidgetModuleInfo | null {
  return useShellStore((state) => state.modules.find((module) => module.id === widgetId) ?? null);
}

export function useShellDndViewModel() {
  const activeId = useShellStore((state) => state.activeId);
  const overId = useShellStore((state) => state.overId);
  return { activeId, overId };
}

export function useShellSettingsViewModel() {
  const activeLocale = useShellLocale();
  const isSettingsOpen = useShellStore((state) => state.isSettingsOpen);
  const isSaving = useShellStore((state) => state.isSaving);
  const modules = useShellStore((state) => state.modules);
  const settingsDraft = useShellStore((state) => state.settingsDraft);

  return {
    isSettingsOpen,
    isSaving,
    modules,
    settingsDraft,
    activeLocale
  };
}

export function useShellLayoutViewModel(): ShellLayoutViewModel {
  const layout = useShellStore((state) => state.layout);
  const draftLayout = useShellStore((state) => state.draftLayout);
  const modules = useShellStore((state) => state.modules);
  const layoutSettings = useShellStore((state) => state.layoutSettings);
  const isEditMode = useShellStore((state) => state.isEditMode);
  const activeId = useShellStore((state) => state.activeId);
  const overId = useShellStore((state) => state.overId);

  return useMemo(() => {
    const moduleMap = new Map(modules.map((module) => [module.id, module]));
    const visibleWidgetIds = getVisibleWidgetIds(modules);
    const sourceLayout = isEditMode ? draftLayout : layout;
    const visibleLayout = getVisibleLayout(sourceLayout, visibleWidgetIds);
    const previewLayout = isEditMode
      ? buildPreviewLayout(visibleLayout, activeId, overId)
      : visibleLayout.map((item) => ({ kind: 'widget' as const, item }));

    return {
      moduleMap,
      visibleLayout,
      previewLayout,
      hasUnsavedChanges: hasUnsavedLayoutChanges(layout, draftLayout),
      columnsStyle: {
        '--desktop-columns': String(layoutSettings.desktopColumns),
        '--mobile-columns': String(layoutSettings.mobileColumns)
      }
    };
  }, [activeId, draftLayout, isEditMode, layout, layoutSettings.desktopColumns, layoutSettings.mobileColumns, modules, overId]);
}

import { DateTime } from 'luxon';
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { ResolvedShellTheme, WidgetModuleInfo } from '../../../entities/widget/model/types';
import { getDailyQuote, getShellText } from '../lib/i18n';
import { AUTO_THEME_DAY_START_HOUR, AUTO_THEME_NIGHT_START_HOUR } from './constants';
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
  const locale = useShellStore((state) => state.layoutSettings.locale);
  return useMemo(() => resolveDisplayLocale(locale), [locale]);
}

export function useShellTheme() {
  return useShellStore((state) => state.layoutSettings.theme);
}

export function useResolvedShellTheme(): ResolvedShellTheme {
  const configuredTheme = useShellTheme();
  const nowIso = useShellStore((state) => state.nowIso);

  if (configuredTheme === 'day' || configuredTheme === 'night') {
    return configuredTheme;
  }

  const hour = DateTime.fromISO(nowIso).hour;
  return hour >= AUTO_THEME_DAY_START_HOUR && hour < AUTO_THEME_NIGHT_START_HOUR ? 'day' : 'night';
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
  const activeTheme = useShellTheme();
  const isSettingsOpen = useShellStore((state) => state.isSettingsOpen);
  const isSaving = useShellStore((state) => state.isSaving);
  const modules = useShellStore((state) => state.modules);
  const settingsDraft = useShellStore((state) => state.settingsDraft);

  return {
    isSettingsOpen,
    isSaving,
    modules,
    settingsDraft,
    activeLocale,
    activeTheme
  };
}

export function useShellClockViewModel() {
  const nowIso = useShellStore((state) => state.nowIso);
  const activeLocale = useShellLocale();

  return useMemo(() => {
    const luxonLocale = activeLocale === 'ru' ? 'ru' : 'en';
    const now = DateTime.fromISO(nowIso).setLocale(luxonLocale);

    return {
      now,
      formattedTime: now.toFormat('HH:mm:ss'),
      formattedDate: now.toFormat(activeLocale === 'ru' ? 'cccc, d LLLL' : 'cccc, LLLL d'),
      quote: getDailyQuote(activeLocale, now),
      greeting: getShellText(activeLocale, 'greeting')
    };
  }, [activeLocale, nowIso]);
}

export function useShellI18n() {
  const activeLocale = useShellLocale();

  return useMemo(
    () => ({
      locale: activeLocale,
      t: (key: Parameters<typeof getShellText>[1]) => getShellText(activeLocale, key)
    }),
    [activeLocale]
  );
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
      } as CSSProperties
    };
  }, [activeId, draftLayout, isEditMode, layout, layoutSettings.desktopColumns, layoutSettings.mobileColumns, modules, overId]);
}

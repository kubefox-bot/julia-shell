import type { LayoutSettings } from '../../../entities/widget/model/types';
import type { ShellSettingsDraft, ShellSettingsResponse, ShellStoreState } from './types';
import { normalizeLayout } from './layout';

export function sanitizeColumns(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(12, Math.round(value)));
}

export function toSettingsDraft(layoutSettings: LayoutSettings): ShellSettingsDraft {
  return {
    desktopColumns: layoutSettings.desktopColumns,
    mobileColumns: layoutSettings.mobileColumns,
    locale: layoutSettings.locale,
    theme: layoutSettings.theme
  };
}

export function buildShellStatePatch(currentState: ShellStoreState, response: ShellSettingsResponse) {
  const normalizedLayout = normalizeLayout(response.layout, response.modules);

  return {
    layout: normalizedLayout,
    draftLayout: normalizedLayout,
    modules: response.modules,
    layoutSettings: response.layoutSettings,
    settingsDraft: toSettingsDraft(response.layoutSettings),
    error: null,
    loading: false,
    isSaving: false,
    activeId: null,
    overId: null,
    isEditMode: currentState.isEditMode,
    isSettingsOpen: currentState.isSettingsOpen,
    browserLocale: currentState.browserLocale,
    nowIso: currentState.nowIso
  };
}

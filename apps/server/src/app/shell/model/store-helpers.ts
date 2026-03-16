import type { LayoutSettings } from '@/entities/widget/model/types'
import {
  SHELL_LAYOUT_COLUMNS_MAX,
  SHELL_LAYOUT_COLUMNS_MIN,
  SHELL_STATUS_POLL_INTERVAL_DEFAULT_MS,
  SHELL_STATUS_POLL_INTERVAL_MAX_MS,
  SHELL_STATUS_POLL_INTERVAL_MIN_MS,
} from './constants'
import { normalizeLayout } from './layout'
import type { ShellSettingsDraft, ShellSettingsResponse, ShellStoreState } from './types'

export function sanitizeColumns(value: number) {
  if (!Number.isFinite(value)) {
    return SHELL_LAYOUT_COLUMNS_MIN
  }

  return Math.max(SHELL_LAYOUT_COLUMNS_MIN, Math.min(SHELL_LAYOUT_COLUMNS_MAX, Math.round(value)))
}

export function toSettingsDraft(layoutSettings: LayoutSettings): ShellSettingsDraft {
  return {
    desktopColumns: layoutSettings.desktopColumns,
    mobileColumns: layoutSettings.mobileColumns,
    locale: layoutSettings.locale,
    theme: layoutSettings.theme,
  }
}

export function sanitizePollIntervalMs(value: number) {
  if (!Number.isFinite(value)) {
    return SHELL_STATUS_POLL_INTERVAL_DEFAULT_MS
  }

  const rounded = Math.round(value)
  return Math.max(
    SHELL_STATUS_POLL_INTERVAL_MIN_MS,
    Math.min(SHELL_STATUS_POLL_INTERVAL_MAX_MS, rounded)
  )
}

export function buildShellStatePatch(
  currentState: ShellStoreState,
  response: ShellSettingsResponse
) {
  const normalizedLayout = normalizeLayout(response.layout, response.modules)
  const statusPollIntervalMs = sanitizePollIntervalMs(
    response.statusPollIntervalMs ??
      currentState.statusPollIntervalMs ??
      SHELL_STATUS_POLL_INTERVAL_DEFAULT_MS
  )

  return {
    platform: response.platform,
    layout: normalizedLayout,
    draftLayout: normalizedLayout,
    modules: response.modules,
    layoutSettings: response.layoutSettings,
    statusPollIntervalMs,
    settingsDraft: toSettingsDraft(response.layoutSettings),
    error: null,
    loading: false,
    isSaving: false,
    activeId: null,
    overId: null,
    isEditMode: currentState.isEditMode,
    isSettingsOpen: currentState.isSettingsOpen,
    browserLocale: currentState.browserLocale,
    nowIso: currentState.nowIso,
  }
}

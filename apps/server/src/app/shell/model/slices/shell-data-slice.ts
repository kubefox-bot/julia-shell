import type { StateCreator } from 'zustand'
import { fetchShellSettings, toggleModule as toggleModuleRequest } from '../../lib/api'
import { SHELL_STATUS_POLL_INTERVAL_DEFAULT_MS } from '../constants'
import { buildShellStatePatch } from '../store-helpers'
import type { ShellStore, ShellStoreActions, ShellStoreState } from '../types'
import type { ShellLocale } from '../../../../entities/widget/model/types'
import { readLocaleCookieFromDocument } from '@shared/lib/locale-cookie'

export type ShellDataSlice = Pick<
  ShellStoreState,
  | 'loading'
  | 'error'
  | 'isSaving'
  | 'browserLocale'
  | 'nowIso'
  | 'platform'
  | 'layout'
  | 'draftLayout'
  | 'modules'
  | 'layoutSettings'
  | 'statusPollIntervalMs'
> &
  Pick<
    ShellStoreActions,
    'hydrateShell' | 'setBrowserLocale' | 'tickNow' | 'clearError' | 'loadShell' | 'toggleModule'
  >

function resolveInitialShellLocale(): ShellLocale {
  return  readLocaleCookieFromDocument() ?? "ru";

}

export const createShellDataSlice: StateCreator<ShellStore, [], [], ShellDataSlice> = (
  set,
  get
) => ({
  loading: true,
  error: null,
  isSaving: false,
  browserLocale: null,
  nowIso: new Date().toISOString(),
  platform: 'windows',
  layout: [],
  draftLayout: [],
  modules: [],
  layoutSettings: {
    desktopColumns: 12,
    mobileColumns: 1,
    locale: resolveInitialShellLocale(),
    theme: 'auto',
  },
  statusPollIntervalMs: SHELL_STATUS_POLL_INTERVAL_DEFAULT_MS,
  hydrateShell: (response) => {
    set((state) => buildShellStatePatch(state, response))
  },
  setBrowserLocale: (locale) => {
    set({ browserLocale: locale })
  },
  tickNow: (nowIso) => {
    set({ nowIso: nowIso ?? new Date().toISOString() })
  },
  clearError: () => {
    set({ error: null })
  },
  loadShell: async () => {
    set({ loading: true, error: null })

    try {
      const response = await fetchShellSettings()
      set((state) => buildShellStatePatch(state, response))
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Ошибка загрузки shell.',
      })
    }
  },
  toggleModule: async (widgetId, enabled) => {
    set({ error: null })

    try {
      await toggleModuleRequest(widgetId, enabled)
      await get().loadShell()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Не удалось изменить состояние модуля.',
      })
    }
  },
})

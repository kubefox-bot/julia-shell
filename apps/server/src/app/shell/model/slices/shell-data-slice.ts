import type { StateCreator } from 'zustand'
import { Result, match } from 'oxide.ts'
import { fetchShellSettings, toggleModule as toggleModuleRequest } from '../../lib/api'
import { SHELL_STATUS_POLL_INTERVAL_DEFAULT_MS } from '../constants'
import { buildShellStatePatch } from '../store-helpers'
import type { ShellStore, ShellStoreActions, ShellStoreState } from '../types'
import type { ShellLocale } from '@/entities/widget/model/types'
import { readLocaleCookieFromDocument } from '@shared/lib/locale/cookie'
import { nowIso as getNowIso } from '@shared/lib/time'
import { toErrorMessage } from '@shared/utils'

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
  return readLocaleCookieFromDocument() ?? 'ru'
}

export const createShellDataSlice: StateCreator<ShellStore, [], [], ShellDataSlice> = (
  set,
  get
) => ({
  loading: true,
  error: null,
  isSaving: false,
  browserLocale: null,
  nowIso: getNowIso(),
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
    set({ nowIso: nowIso ?? getNowIso() })
  },
  clearError: () => {
    set({ error: null })
  },
  loadShell: async () => {
    set({ loading: true, error: null })

    const responseResult = await Result.safe(fetchShellSettings())

    match(responseResult, {
      Ok: (response) => {
        set((state) => buildShellStatePatch(state, response))
      },
      Err: (error) => {
        set({
          loading: false,
          error: toErrorMessage(error, 'Ошибка загрузки shell.'),
        })
      },
    })
  },
  toggleModule: async (widgetId, enabled) => {
    set({ error: null })

    const toggleResult = await Result.safe(toggleModuleRequest(widgetId, enabled))

    await match(toggleResult, {
      Ok: async () => get().loadShell(),
      Err: async (error) => {
        set({
          error: toErrorMessage(error, 'Не удалось изменить состояние модуля.'),
        })
      },
    })
  },
})

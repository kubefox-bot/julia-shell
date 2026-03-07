import type { StateCreator } from 'zustand';
import { fetchShellSettings, toggleModule as toggleModuleRequest } from '../../lib/api';
import type { ShellStore, ShellStoreActions, ShellStoreState } from '../types';
import { buildShellStatePatch } from '../store-helpers';

export type ShellDataSlice = Pick<
  ShellStoreState,
  'loading' | 'error' | 'isSaving' | 'browserLocale' | 'nowIso' | 'platform' | 'layout' | 'draftLayout' | 'modules' | 'layoutSettings'
> &
  Pick<ShellStoreActions, 'setBrowserLocale' | 'tickNow' | 'clearError' | 'loadShell' | 'toggleModule'>;

export const createShellDataSlice: StateCreator<ShellStore, [], [], ShellDataSlice> = (set, get) => ({
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
    locale: 'system',
    theme: 'auto'
  },
  setBrowserLocale: (locale) => {
    set({ browserLocale: locale });
  },
  tickNow: (nowIso) => {
    set({ nowIso: nowIso ?? new Date().toISOString() });
  },
  clearError: () => {
    set({ error: null });
  },
  loadShell: async () => {
    set({ loading: true, error: null });

    try {
      const response = await fetchShellSettings();
      set((state) => buildShellStatePatch(state, response));
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Ошибка загрузки shell.'
      });
    }
  },
  toggleModule: async (widgetId, enabled) => {
    set({ error: null });

    try {
      await toggleModuleRequest(widgetId, enabled);
      await get().loadShell();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Не удалось изменить состояние модуля.'
      });
    }
  }
});

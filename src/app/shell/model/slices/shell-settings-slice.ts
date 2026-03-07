import type { StateCreator } from 'zustand';
import { saveShellLayout } from '../../lib/api';
import { resolveDisplayLocale } from '../../../../shared/lib/locale';
import type { ShellStore, ShellStoreActions, ShellStoreState } from '../types';
import { buildShellStatePatch, sanitizeColumns, toSettingsDraft } from '../store-helpers';

export type ShellSettingsSlice = Pick<
  ShellStoreState,
  'isSettingsOpen' | 'settingsDraft'
> &
  Pick<
    ShellStoreActions,
    'openSettings' | 'closeSettings' | 'updateSettingsDraftColumns' | 'updateSettingsDraftLocale' | 'toggleLocale' | 'updateSettingsDraftTheme' | 'saveSettings' | 'toggleTheme'
  >;

export const createShellSettingsSlice: StateCreator<ShellStore, [], [], ShellSettingsSlice> = (set, get) => ({
  isSettingsOpen: false,
  settingsDraft: {
    desktopColumns: 12,
    mobileColumns: 1,
    locale: 'system',
    theme: 'auto'
  },
  openSettings: () => {
    const { layoutSettings } = get();
    set({
      isSettingsOpen: true,
      settingsDraft: toSettingsDraft(layoutSettings)
    });
  },
  closeSettings: () => {
    const { layoutSettings } = get();
    set({
      isSettingsOpen: false,
      settingsDraft: toSettingsDraft(layoutSettings)
    });
  },
  updateSettingsDraftColumns: (next) => {
    set((state) => ({
      settingsDraft: {
        ...state.settingsDraft,
        desktopColumns:
          typeof next.desktopColumns === 'number'
            ? sanitizeColumns(next.desktopColumns)
            : state.settingsDraft.desktopColumns,
        mobileColumns:
          typeof next.mobileColumns === 'number'
            ? sanitizeColumns(next.mobileColumns)
            : state.settingsDraft.mobileColumns
      }
    }));
  },
  updateSettingsDraftLocale: (locale) => {
    set((state) => ({
      settingsDraft: {
        ...state.settingsDraft,
        locale
      }
    }));
  },
  toggleLocale: async () => {
    const { layoutSettings, draftLayout, browserLocale } = get();
    const activeLocale = resolveDisplayLocale(layoutSettings.locale, browserLocale);
    const nextLocale = activeLocale === 'en' ? 'ru' : 'en';
    set({ isSaving: true, error: null });

    try {
      const response = await saveShellLayout({
        desktopColumns: layoutSettings.desktopColumns,
        mobileColumns: layoutSettings.mobileColumns,
        locale: nextLocale,
        theme: layoutSettings.theme,
        layout: draftLayout
      });

      set((state) => buildShellStatePatch(state, response));
    } catch (error) {
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Не удалось переключить язык.'
      });
    }
  },
  updateSettingsDraftTheme: (theme) => {
    set((state) => ({
      settingsDraft: {
        ...state.settingsDraft,
        theme
      }
    }));
  },
  saveSettings: async () => {
    const { settingsDraft, draftLayout } = get();
    set({ isSaving: true, error: null });

    try {
      const response = await saveShellLayout({
        desktopColumns: settingsDraft.desktopColumns,
        mobileColumns: settingsDraft.mobileColumns,
        locale: settingsDraft.locale,
        theme: settingsDraft.theme,
        layout: draftLayout
      });

      set((state) => ({
        ...buildShellStatePatch(state, response),
        isSettingsOpen: false,
        isEditMode: state.isEditMode
      }));
    } catch (error) {
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Не удалось сохранить settings.'
      });
    }
  },
  toggleTheme: async () => {
    const { layoutSettings, draftLayout } = get();
    const nextTheme =
      layoutSettings.theme === 'auto'
        ? 'day'
        : layoutSettings.theme === 'day'
          ? 'night'
          : 'auto';
    set({ isSaving: true, error: null });

    try {
      const response = await saveShellLayout({
        desktopColumns: layoutSettings.desktopColumns,
        mobileColumns: layoutSettings.mobileColumns,
        locale: layoutSettings.locale,
        theme: nextTheme,
        layout: draftLayout
      });

      set((state) => buildShellStatePatch(state, response));
    } catch (error) {
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Не удалось переключить тему.'
      });
    }
  }
});

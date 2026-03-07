import type { StateCreator } from 'zustand';
import { saveShellLayout } from '../../lib/api';
import type { ShellStore, ShellStoreActions, ShellStoreState } from '../types';
import { buildShellStatePatch, sanitizeColumns, toSettingsDraft } from '../store-helpers';

export type ShellSettingsSlice = Pick<
  ShellStoreState,
  'isSettingsOpen' | 'settingsDraft'
> &
  Pick<
    ShellStoreActions,
    'openSettings' | 'closeSettings' | 'updateSettingsDraftColumns' | 'updateSettingsDraftLocale' | 'saveSettings'
  >;

export const createShellSettingsSlice: StateCreator<ShellStore, [], [], ShellSettingsSlice> = (set, get) => ({
  isSettingsOpen: false,
  settingsDraft: {
    desktopColumns: 12,
    mobileColumns: 1,
    locale: 'system'
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
  saveSettings: async () => {
    const { settingsDraft, draftLayout } = get();
    set({ isSaving: true, error: null });

    try {
      const response = await saveShellLayout({
        desktopColumns: settingsDraft.desktopColumns,
        mobileColumns: settingsDraft.mobileColumns,
        locale: settingsDraft.locale,
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
  }
});

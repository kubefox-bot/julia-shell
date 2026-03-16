import type { StateCreator } from 'zustand';
import { Result, match } from 'oxide.ts';
import { saveShellLayout } from '../../lib/api';
import type { ShellStore, ShellStoreActions, ShellStoreState } from '../types';
import { buildShellStatePatch } from '../store-helpers';

export type ShellLayoutSlice = Pick<ShellStoreState, 'isEditMode'> &
  Pick<ShellStoreActions, 'startEdit' | 'cancelEdit' | 'saveLayout' | 'changeWidgetSize'>;

function toErrorMessage(error: Error, fallback: string) {
  return error.message || fallback;
}

export const createShellLayoutSlice: StateCreator<ShellStore, [], [], ShellLayoutSlice> = (set, get) => ({
  isEditMode: false,
  startEdit: () => {
    set((state) => ({
      isEditMode: true,
      draftLayout: state.layout,
      activeId: null,
      overId: null
    }));
  },
  cancelEdit: () => {
    set((state) => ({
      draftLayout: state.layout,
      isEditMode: false,
      activeId: null,
      overId: null
    }));
  },
  saveLayout: async () => {
    const { layoutSettings, draftLayout } = get();
    set({ isSaving: true, error: null });

    const responseResult = await Result.safe(
      saveShellLayout({
        desktopColumns: layoutSettings.desktopColumns,
        mobileColumns: layoutSettings.mobileColumns,
        locale: layoutSettings.locale,
        theme: layoutSettings.theme,
        layout: draftLayout
      })
    );

    match(responseResult, {
      Ok: (response) => {
        set((state) => ({
          ...buildShellStatePatch(state, response),
          isEditMode: false
        }));
      },
      Err: (error) => {
        set({
          isSaving: false,
          error: toErrorMessage(error, 'Не удалось сохранить layout.')
        });
      }
    });
  },
  changeWidgetSize: (widgetId, size) => {
    set((state) => ({
      draftLayout: state.draftLayout.map((item) => {
        if (item.widgetId !== widgetId) {
          return item;
        }

        return {
          ...item,
          size
        };
      })
    }));
  }
});

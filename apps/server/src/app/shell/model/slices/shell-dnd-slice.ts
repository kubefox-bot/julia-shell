import type { StateCreator } from 'zustand';
import type { LayoutItem } from '../../../../entities/widget/model/types';
import type { ShellStore, ShellStoreActions, ShellStoreState } from '../types';
import { getVisibleLayout, getVisibleWidgetIds, reorderVisibleLayout } from '../layout';

export type ShellDndSlice = Pick<ShellStoreState, 'activeId' | 'overId'> &
  Pick<ShellStoreActions, 'startDrag' | 'overDrag' | 'endDrag'>;

export const createShellDndSlice: StateCreator<ShellStore, [], [], ShellDndSlice> = (set, get) => ({
  activeId: null,
  overId: null,
  startDrag: (widgetId) => {
    set({ activeId: widgetId });
  },
  overDrag: (widgetId) => {
    set({ overId: widgetId });
  },
  endDrag: () => {
    const { activeId, overId, draftLayout, layout, modules, isEditMode } = get();
    const sourceLayout = isEditMode ? draftLayout : layout;
    const visibleIds = getVisibleWidgetIds(modules);
    const visibleLayout = getVisibleLayout(sourceLayout, visibleIds) as LayoutItem[];

    set({
      draftLayout: activeId ? reorderVisibleLayout(draftLayout, visibleLayout, activeId, overId) : draftLayout,
      activeId: null,
      overId: null
    });
  }
});

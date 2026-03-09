import { create } from 'zustand';
import type { ShellStore } from './types';
import { createShellDataSlice } from './slices/shell-data-slice';
import { createShellSettingsSlice } from './slices/shell-settings-slice';
import { createShellLayoutSlice } from './slices/shell-layout-slice';
import { createShellDndSlice } from './slices/shell-dnd-slice';
import { createPassportSlice } from '@passport/client';

export const createShellStore = () =>
  create<ShellStore>()((...args) => ({
    ...createShellDataSlice(...args),
    ...createPassportSlice(...args),
    ...createShellSettingsSlice(...args),
    ...createShellLayoutSlice(...args),
    ...createShellDndSlice(...args)
  }));

export const useShellStore = createShellStore();

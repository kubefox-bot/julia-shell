import { create } from 'zustand';
import type { ShellStore } from './types';
import { createShellDataSlice } from './slices/shell-data-slice';
import { createShellSettingsSlice } from './slices/shell-settings-slice';
import { createShellLayoutSlice } from './slices/shell-layout-slice';
import { createShellDndSlice } from './slices/shell-dnd-slice';
import { createAgentStatusSlice } from '../../agent-service/model/slices/agent-status-slice';

export const createShellStore = () =>
  create<ShellStore>()((...args) => ({
    ...createShellDataSlice(...args),
    ...createAgentStatusSlice(...args),
    ...createShellSettingsSlice(...args),
    ...createShellLayoutSlice(...args),
    ...createShellDndSlice(...args)
  }));

export const useShellStore = createShellStore();

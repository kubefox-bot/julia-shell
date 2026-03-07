import type { CSSProperties, ComponentType } from 'react';
import type { HostPlatform, LayoutItem, LayoutSettings, ResolvedShellTheme, ShellLocale, ShellTheme, WidgetModuleInfo, WidgetSize } from '../../../entities/widget/model/types';

export type ShellSettingsResponse = {
  platform: HostPlatform;
  layoutSettings: LayoutSettings;
  layout: LayoutItem[];
  modules: WidgetModuleInfo[];
};

export type ShellSettingsDraft = {
  desktopColumns: number;
  mobileColumns: number;
  locale: ShellLocale;
  theme: ShellTheme;
};

export type PreviewLayoutEntry =
  | { kind: 'widget'; item: LayoutItem }
  | { kind: 'placeholder'; item: LayoutItem };

export type ShellStoreState = {
  loading: boolean;
  error: string | null;
  isSaving: boolean;
  isEditMode: boolean;
  isSettingsOpen: boolean;
  browserLocale: string | null;
  nowIso: string;
  platform: HostPlatform;
  layout: LayoutItem[];
  draftLayout: LayoutItem[];
  modules: WidgetModuleInfo[];
  layoutSettings: LayoutSettings;
  settingsDraft: ShellSettingsDraft;
  activeId: string | null;
  overId: string | null;
};

export type ShellStoreActions = {
  setBrowserLocale: (locale: string | null) => void;
  tickNow: (nowIso?: string) => void;
  clearError: () => void;
  loadShell: () => Promise<void>;
  openSettings: () => void;
  closeSettings: () => void;
  updateSettingsDraftColumns: (next: { desktopColumns?: number; mobileColumns?: number }) => void;
  updateSettingsDraftLocale: (locale: ShellLocale) => void;
  toggleLocale: () => Promise<void>;
  updateSettingsDraftTheme: (theme: ShellTheme) => void;
  toggleTheme: () => Promise<void>;
  startEdit: () => void;
  cancelEdit: () => void;
  saveLayout: () => Promise<void>;
  saveSettings: () => Promise<void>;
  toggleModule: (widgetId: string, enabled: boolean) => Promise<void>;
  changeWidgetSize: (widgetId: string, size: WidgetSize) => void;
  startDrag: (widgetId: string) => void;
  overDrag: (widgetId: string | null) => void;
  endDrag: () => void;
};

export type ShellStore = ShellStoreState & ShellStoreActions;

export type ShellRegistryEntry = {
  widgetId: string;
  Icon: ComponentType;
  Render: ComponentType<{ locale: 'ru' | 'en'; theme: ResolvedShellTheme; platform: HostPlatform }>;
};

export type ShellLayoutViewModel = {
  moduleMap: Map<string, WidgetModuleInfo>;
  visibleLayout: LayoutItem[];
  previewLayout: PreviewLayoutEntry[];
  hasUnsavedChanges: boolean;
  columnsStyle: CSSProperties;
};

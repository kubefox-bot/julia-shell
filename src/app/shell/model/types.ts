import type { LayoutItem, LayoutSettings, WidgetModuleInfo } from '../../../entities/widget/model/types';

export type ShellSettingsResponse = {
  layoutSettings: LayoutSettings;
  layout: LayoutItem[];
  modules: WidgetModuleInfo[];
};

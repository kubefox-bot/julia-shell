import type { LayoutItem, LayoutSettings, WidgetModuleInfo, WidgetSize } from '../../entities/widget/model/types';
import { getLayoutItems, getLayoutSettings, getModuleStates, ensureDefaultLayoutItem, ensureDefaultModuleState, replaceLayout, saveLayoutSettings, setModuleEnabled } from '../db/core-repository';
import { listDiscoveredWidgets } from '../registry/registry';

const VALID_SIZES = new Set<WidgetSize>(['small', 'medium', 'large']);

function sanitizeColumns(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  return Math.max(1, Math.min(12, rounded));
}

function normalizeLayoutItems(items: LayoutItem[]) {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (!item.widgetId?.trim()) return false;
      if (seen.has(item.widgetId)) return false;
      if (!VALID_SIZES.has(item.size)) return false;
      seen.add(item.widgetId);
      return true;
    })
    .map((item, index) => ({
      widgetId: item.widgetId,
      order: index,
      size: item.size
    }));
}

export async function ensureCoreDefaults() {
  const widgets = await listDiscoveredWidgets();

  widgets.forEach((widget, index) => {
    ensureDefaultLayoutItem({
      widgetId: widget.plugin.manifest.widgetId,
      order: index,
      size: widget.plugin.manifest.defaultSize
    });

    ensureDefaultModuleState(widget.plugin.manifest.widgetId, widget.runtime.ready);
  });
}

export async function listShellModules(): Promise<WidgetModuleInfo[]> {
  await ensureCoreDefaults();
  const widgets = await listDiscoveredWidgets();
  const states = getModuleStates();
  const stateMap = new Map(states.map((state) => [state.widgetId, state]));

  const modules: WidgetModuleInfo[] = [];

  for (const widget of widgets) {
    const state = stateMap.get(widget.plugin.manifest.widgetId);
    let enabled = state?.enabled ?? widget.runtime.ready;
    const notReadyReasons = [...widget.runtime.notReadyReasons];

    if (!widget.runtime.ready && enabled) {
      const reason = notReadyReasons[0] ?? 'Widget is not ready.';
      setModuleEnabled(widget.plugin.manifest.widgetId, false, reason);
      enabled = false;
    }

    modules.push({
      widgetId: widget.plugin.manifest.widgetId,
      name: widget.plugin.manifest.name,
      version: widget.plugin.manifest.version,
      description: widget.plugin.manifest.description,
      ready: widget.runtime.ready,
      enabled,
      notReadyReasons,
      defaultSize: widget.plugin.manifest.defaultSize,
      supportedSizes: widget.plugin.manifest.supportedSizes
    });
  }

  return modules.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export async function getShellSettings() {
  await ensureCoreDefaults();
  const modules = await listShellModules();
  const settings = getLayoutSettings();
  const layout = getLayoutItems();

  return {
    layoutSettings: settings,
    layout,
    modules
  };
}

export async function updateLayoutSettings(input: {
  desktopColumns?: number;
  mobileColumns?: number;
  layout?: LayoutItem[];
}) {
  const current = getLayoutSettings();

  const nextSettings: LayoutSettings = {
    desktopColumns: sanitizeColumns(input.desktopColumns ?? current.desktopColumns, current.desktopColumns),
    mobileColumns: sanitizeColumns(input.mobileColumns ?? current.mobileColumns, current.mobileColumns)
  };

  saveLayoutSettings(nextSettings);

  if (Array.isArray(input.layout)) {
    const normalized = normalizeLayoutItems(input.layout);
    replaceLayout(normalized);
  }

  return getShellSettings();
}

export async function setShellModuleEnabled(widgetId: string, enabled: boolean) {
  const modules = await listShellModules();
  const moduleInfo = modules.find((module) => module.widgetId === widgetId);

  if (!moduleInfo) {
    return {
      ok: false,
      status: 404,
      message: 'Unknown widgetId.'
    };
  }

  if (enabled && !moduleInfo.ready) {
    return {
      ok: false,
      status: 409,
      message: 'Widget is not ready and cannot be enabled.',
      notReadyReasons: moduleInfo.notReadyReasons
    };
  }

  setModuleEnabled(widgetId, enabled, enabled ? null : 'Disabled by user.');

  return {
    ok: true,
    status: 200,
    module: (await listShellModules()).find((module) => module.widgetId === widgetId)
  };
}

export async function getEnabledWidgetIds() {
  const modules = await listShellModules();
  return new Set(modules.filter((module) => module.ready && module.enabled).map((module) => module.widgetId));
}

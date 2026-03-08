import type { HostPlatform, LayoutItem, LayoutSettings, WidgetModuleInfo, WidgetSize } from '../../entities/widget/model/types';
import {
  ensureDefaultLayoutItem,
  ensureDefaultModuleState,
  getLayoutItems,
  getLayoutSettings,
  getModuleStates,
  replaceLayout,
  saveLayoutSettings,
  setModuleEnabled
} from '../db/core-repository';
import { listDiscoveredWidgets } from '../registry/registry';

const VALID_SIZES = new Set<WidgetSize>(['small', 'medium', 'large']);
const AUTO_NOT_READY_REASON_PREFIX = 'auto:not-ready:';

function resolveHostPlatform(): HostPlatform {
  if (process.platform === 'win32') {
    return 'windows';
  }

  if (process.platform === 'darwin') {
    return 'macos';
  }

  return 'linux';
}

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

  widgets.forEach((descriptor, index) => {
    ensureDefaultLayoutItem({
      widgetId: descriptor.module.manifest.id,
      order: index,
      size: descriptor.module.manifest.defaultSize
    });

    ensureDefaultModuleState(descriptor.module.manifest.id, descriptor.runtime.ready);
  });
}

export async function listShellModules(): Promise<WidgetModuleInfo[]> {
  await ensureCoreDefaults();
  const widgets = await listDiscoveredWidgets();
  const states = getModuleStates();
  const stateMap = new Map(states.map((state) => [state.widgetId, state]));

  const modules: WidgetModuleInfo[] = [];

  for (const descriptor of widgets) {
    const widgetId = descriptor.module.manifest.id;
    const state = stateMap.get(widgetId);
    let enabled = state?.enabled ?? descriptor.runtime.ready;
    const notReadyReasons = [...descriptor.runtime.notReadyReasons];

    const wasAutoDisabled = Boolean(state?.disabledReason?.startsWith(AUTO_NOT_READY_REASON_PREFIX));

    if (!descriptor.runtime.ready && enabled) {
      const reason = notReadyReasons[0] ?? 'Widget is not ready.';
      setModuleEnabled(widgetId, false, `${AUTO_NOT_READY_REASON_PREFIX}${reason}`);
      enabled = false;
    }

    if (descriptor.runtime.ready && !enabled && wasAutoDisabled) {
      setModuleEnabled(widgetId, true, null);
      enabled = true;
    }

    modules.push({
      id: widgetId,
      name: descriptor.module.manifest.name,
      version: descriptor.module.manifest.version,
      description: descriptor.module.manifest.description,
      headerName: descriptor.module.manifest.headerName,
      normalizedIcon: descriptor.module.normalizedIcon,
      ready: descriptor.runtime.ready,
      enabled,
      notReadyReasons,
      defaultSize: descriptor.module.manifest.defaultSize,
      supportedSizes: descriptor.module.manifest.supportedSizes
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
    platform: resolveHostPlatform(),
    layoutSettings: settings,
    layout,
    modules
  };
}

export async function updateLayoutSettings(input: {
  desktopColumns?: number;
  mobileColumns?: number;
  locale?: LayoutSettings['locale'];
  theme?: LayoutSettings['theme'];
  layout?: LayoutItem[];
}) {
  const current = getLayoutSettings();

  const nextSettings: LayoutSettings = {
    desktopColumns: sanitizeColumns(input.desktopColumns ?? current.desktopColumns, current.desktopColumns),
    mobileColumns: sanitizeColumns(input.mobileColumns ?? current.mobileColumns, current.mobileColumns),
    locale: input.locale ?? current.locale,
    theme: input.theme ?? current.theme
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
  const moduleInfo = modules.find((module) => module.id === widgetId);

  if (!moduleInfo) {
    return {
      ok: false,
      status: 404,
      message: 'Unknown widget id.'
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
    module: (await listShellModules()).find((module) => module.id === widgetId)
  };
}

export async function getEnabledWidgetIds() {
  const modules = await listShellModules();
  return new Set(modules.filter((module) => module.ready && module.enabled).map((module) => module.id));
}

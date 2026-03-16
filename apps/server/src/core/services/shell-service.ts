import type {
  LayoutItem,
  LayoutSettings,
  WidgetModuleInfo,
} from '../../entities/widget/model/types';
import { readRuntimeEnv } from '../env';
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
import {
  buildPassportNotReadyReasons,
  collectRuntimeNotReadyReasons,
  isAutoDisabledReason,
  normalizeLayoutItems,
  resolveHostPlatform,
  resolveModuleEnabledState,
  sanitizeColumns
} from './shell-service.helpers';

export type ShellAccessPolicy = {
  hasPassportAccess?: boolean;
};

export async function ensureCoreDefaults(agentId: string) {
  const widgets = await listDiscoveredWidgets();

  widgets.forEach((descriptor, index) => {
    ensureDefaultLayoutItem(agentId, {
      widgetId: descriptor.module.manifest.id,
      order: index,
      size: descriptor.module.manifest.defaultSize
    });

    ensureDefaultModuleState(agentId, descriptor.module.manifest.id, descriptor.runtime.ready);
  });
}


export async function listShellModules(
  agentId: string,
  policy: ShellAccessPolicy = {}
): Promise<WidgetModuleInfo[]> {
  await ensureCoreDefaults(agentId);
  const widgets = await listDiscoveredWidgets();
  const states = getModuleStates(agentId);
  const stateMap = new Map(states.map((state) => [state.widgetId, state]));
  const hasPassportAccess = policy.hasPassportAccess ?? true;

  const modules: WidgetModuleInfo[] = [];

  for (const descriptor of widgets) {
    const widgetId = descriptor.module.manifest.id;
    const state = stateMap.get(widgetId);
    const notReadyReasons = [
      ...descriptor.runtime.notReadyReasons,
      ...buildPassportNotReadyReasons(widgetId, agentId, hasPassportAccess),
      ...(await collectRuntimeNotReadyReasons(descriptor))
    ];
    const wasAutoDisabled = isAutoDisabledReason(state?.disabledReason);
    const enabledByState = state?.enabled ?? descriptor.runtime.ready;
    const moduleState = resolveModuleEnabledState({
      agentId,
      widgetId,
      enabled: enabledByState,
      notReadyReasons,
      wasAutoDisabled
    });

    modules.push({
      id: widgetId,
      name: descriptor.module.manifest.name,
      version: descriptor.module.manifest.version,
      description: descriptor.module.manifest.description,
      headerName: descriptor.module.manifest.headerName,
      normalizedIcon: descriptor.module.normalizedIcon,
      ready: moduleState.runtimeReady,
      enabled: moduleState.enabled,
      notReadyReasons,
      defaultSize: descriptor.module.manifest.defaultSize,
      supportedSizes: descriptor.module.manifest.supportedSizes
    });
  }

  return modules.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export async function getShellSettings(agentId: string, policy: ShellAccessPolicy = {}) {
  await ensureCoreDefaults(agentId);
  const modules = await listShellModules(agentId, policy);
  const settings = getLayoutSettings(agentId);
  const layout = getLayoutItems(agentId);
  const runtimeEnv = readRuntimeEnv();

  return {
    platform: resolveHostPlatform(),
    layoutSettings: settings,
    layout,
    modules,
    statusPollIntervalMs: runtimeEnv.shellStatusPollIntervalMs
  };
}

export async function updateLayoutSettings(input: {
  agentId: string;
  desktopColumns?: number;
  mobileColumns?: number;
  locale?: LayoutSettings['locale'];
  theme?: LayoutSettings['theme'];
  layout?: LayoutItem[];
}) {
  const current = getLayoutSettings(input.agentId);

  const nextSettings: LayoutSettings = {
    desktopColumns: sanitizeColumns(input.desktopColumns ?? current.desktopColumns, current.desktopColumns),
    mobileColumns: sanitizeColumns(input.mobileColumns ?? current.mobileColumns, current.mobileColumns),
    locale: input.locale ?? current.locale,
    theme: input.theme ?? current.theme
  };

  saveLayoutSettings(input.agentId, nextSettings);

  if (Array.isArray(input.layout)) {
    const normalized = normalizeLayoutItems(input.layout);
    replaceLayout(input.agentId, normalized);
  }

  return getShellSettings(input.agentId);
}

export async function setShellModuleEnabled(
  agentId: string,
  widgetId: string,
  enabled: boolean,
  policy: ShellAccessPolicy = {}
) {
  const modules = await listShellModules(agentId, policy);
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

  setModuleEnabled(agentId, widgetId, enabled, enabled ? null : 'Disabled by user.');

  return {
    ok: true,
    status: 200,
    module: (await listShellModules(agentId, policy)).find((module) => module.id === widgetId)
  };
}

export async function getEnabledWidgetIds(agentId: string, policy: ShellAccessPolicy = {}) {
  const modules = await listShellModules(agentId, policy);
  return new Set(modules.filter((module) => module.ready && module.enabled).map((module) => module.id));
}

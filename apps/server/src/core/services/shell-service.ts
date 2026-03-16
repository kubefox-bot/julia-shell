// biome-ignore lint/nursery/noExcessiveLinesPerFile: Shell policy and layout orchestration are temporarily colocated.
import type {
  HostPlatform,
  LayoutItem,
  LayoutSettings,
  WidgetDescriptor,
  WidgetModuleInfo,
  WidgetSize
} from '../../entities/widget/model/types';
import { readRuntimeEnv } from '../env';
import { passportRuntime } from '@passport/server/runtime';
import {
  PASSPORT_WIDGET_ID_TERMINAL_AGENT,
  PASSPORT_WIDGET_ID_TRANSCRIBE
} from '@passport/server/config/consts';
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
const PASSPORT_REQUIRED_WIDGET_IDS = new Set([
  PASSPORT_WIDGET_ID_TRANSCRIBE,
  PASSPORT_WIDGET_ID_TERMINAL_AGENT
]);
const MIN_SHELL_COLUMNS = 1;
const MAX_SHELL_COLUMNS = 12;

type ShellAccessPolicy = {
  hasPassportAccess?: boolean;
};

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
  return Math.max(MIN_SHELL_COLUMNS, Math.min(MAX_SHELL_COLUMNS, rounded));
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

function requiresCurrentOnlineAgent(widgetId: string) {
  if (widgetId === PASSPORT_WIDGET_ID_TERMINAL_AGENT) {
    return true;
  }

  if (widgetId !== PASSPORT_WIDGET_ID_TRANSCRIBE) {
    return false;
  }

  return !readRuntimeEnv().passportAgentDevModeEnabled;
}

function buildPassportNotReadyReasons(widgetId: string, agentId: string, hasPassportAccess: boolean) {
  if (PASSPORT_REQUIRED_WIDGET_IDS.has(widgetId) && !hasPassportAccess) {
    return [`${widgetId} widget requires agent.`];
  }

  if (
    hasPassportAccess &&
    requiresCurrentOnlineAgent(widgetId) &&
    !passportRuntime.getOnlineAgentSession(agentId)
  ) {
    return [`${widgetId} widget requires agent.`];
  }

  return [];
}

async function collectRuntimeNotReadyReasons(descriptor: WidgetDescriptor) {
  if (PASSPORT_REQUIRED_WIDGET_IDS.has(descriptor.module.manifest.id)) {
    return [];
  }

  try {
    const serverModule = await descriptor.module.loadServerModule();
    if (!serverModule.init) {
      return [];
    }

    const initResult = await serverModule.init();
    if (!initResult || initResult.ready !== false) {
      return [];
    }

    return [initResult.reason?.trim() || 'init() returned not ready.'];
  } catch (error) {
    return [error instanceof Error ? error.message : 'loadServerModule() failed.'];
  }
}

function resolveModuleEnabledState(input: {
  agentId: string;
  widgetId: string;
  enabled: boolean;
  notReadyReasons: string[];
  wasAutoDisabled: boolean;
}) {
  const runtimeReady = input.notReadyReasons.length === 0;
  let enabled = input.enabled;

  if (!runtimeReady && enabled) {
    const reason = input.notReadyReasons[0] ?? 'Widget is not ready.';
    setModuleEnabled(input.agentId, input.widgetId, false, `${AUTO_NOT_READY_REASON_PREFIX}${reason}`);
    enabled = false;
  }

  if (runtimeReady && !enabled && input.wasAutoDisabled) {
    setModuleEnabled(input.agentId, input.widgetId, true, null);
    enabled = true;
  }

  return {
    runtimeReady,
    enabled
  };
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
    const wasAutoDisabled = Boolean(state?.disabledReason?.startsWith(AUTO_NOT_READY_REASON_PREFIX));
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

import type { WidgetDescriptor, WidgetRouteHandler } from '../../entities/widget/model/types';
import { discoverWidgets } from './discovery';

let cachedWidgetsPromise: Promise<WidgetDescriptor[]> | null = null;

async function getWidgets() {
  if (!cachedWidgetsPromise) {
    cachedWidgetsPromise = discoverWidgets();
  }

  return cachedWidgetsPromise;
}

function normalizeAction(action: string) {
  return action.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

function buildHandlerKey(method: string, action: string) {
  const normalizedAction = normalizeAction(action);
  return `${method.toUpperCase()} ${normalizedAction}`.trim();
}

export async function listDiscoveredWidgets() {
  return getWidgets();
}

export async function getWidgetById(widgetId: string) {
  const widgets = await getWidgets();
  return widgets.find((entry) => entry.module.manifest.id === widgetId) ?? null;
}

export async function resolveWidgetHandler(widgetId: string, method: string, action: string): Promise<{
  descriptor: WidgetDescriptor;
  handler: WidgetRouteHandler;
  ready: boolean;
  notReadyReasons: string[];
} | null> {
  const descriptor = await getWidgetById(widgetId);
  if (!descriptor) {
    return null;
  }

  const serverModule = await descriptor.module.loadServerModule();
  const key = buildHandlerKey(method, action);
  const fallbackKey = buildHandlerKey('*', action);
  const handler = serverModule.handlers[key] ?? serverModule.handlers[fallbackKey] ?? null;

  if (!handler) {
    return null;
  }

  return {
    descriptor,
    handler,
    ready: descriptor.runtime.ready,
    notReadyReasons: descriptor.runtime.notReadyReasons
  };
}

export function invalidateWidgetRegistryCache() {
  cachedWidgetsPromise = null;
}

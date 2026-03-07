import type { WidgetRouteHandler, WidgetServerPlugin } from '../../entities/widget/model/types';
import { discoverWidgets, type DiscoveredWidget } from './discovery';

let cachedWidgetsPromise: Promise<DiscoveredWidget[]> | null = null;

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
  return widgets.find((entry) => entry.plugin.manifest.widgetId === widgetId) ?? null;
}

export async function resolveWidgetHandler(widgetId: string, method: string, action: string): Promise<{
  plugin: WidgetServerPlugin;
  handler: WidgetRouteHandler;
  ready: boolean;
  notReadyReasons: string[];
} | null> {
  const widget = await getWidgetById(widgetId);
  if (!widget) {
    return null;
  }

  const key = buildHandlerKey(method, action);
  const fallbackKey = buildHandlerKey('*', action);
  const handler = widget.plugin.handlers[key] ?? widget.plugin.handlers[fallbackKey] ?? null;

  if (!handler) {
    return null;
  }

  return {
    plugin: widget.plugin,
    handler,
    ready: widget.runtime.ready,
    notReadyReasons: widget.runtime.notReadyReasons
  };
}

export function invalidateWidgetRegistryCache() {
  cachedWidgetsPromise = null;
}

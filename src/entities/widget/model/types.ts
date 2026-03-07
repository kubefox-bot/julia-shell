export type WidgetSize = 'small' | 'medium' | 'large';

export type WidgetManifest = {
  widgetId: string;
  name: string;
  version: string;
  description: string;
  ready: boolean;
  defaultSize: WidgetSize;
  supportedSizes: WidgetSize[];
  capabilities: string[];
  channels: string[];
};

export type WidgetRuntimeState = {
  ready: boolean;
  notReadyReasons: string[];
};

export type WidgetDescriptor = {
  manifest: WidgetManifest;
  runtime: WidgetRuntimeState;
};

export type WidgetRouteContext = {
  request: Request;
  action: string;
  actionSegments: string[];
  params: {
    id: string;
  };
};

export type WidgetRouteHandler = (context: WidgetRouteContext) => Promise<Response> | Response;

export type WidgetServerPlugin = {
  manifest: WidgetManifest;
  handlers: Record<string, WidgetRouteHandler>;
  init?: () => Promise<{ ready: boolean; reason?: string } | void> | { ready: boolean; reason?: string } | void;
};

export type WidgetModuleInfo = {
  widgetId: string;
  name: string;
  version: string;
  description: string;
  ready: boolean;
  enabled: boolean;
  notReadyReasons: string[];
  defaultSize: WidgetSize;
  supportedSizes: WidgetSize[];
};

export type LayoutItem = {
  widgetId: string;
  order: number;
  size: WidgetSize;
};

export type LayoutSettings = {
  desktopColumns: number;
  mobileColumns: number;
};

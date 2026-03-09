import type { ComponentType } from 'react';

export type WidgetSize = 'small' | 'medium' | 'large';
export type ShellLocale = 'ru' | 'en';
export type ShellTheme = 'auto' | 'day' | 'night';
export type ResolvedShellTheme = 'day' | 'night';
export type DisplayLocale = 'ru' | 'en';
export type HostPlatform = 'windows' | 'macos' | 'linux';

export type WidgetHeaderName = {
  ru: string;
  en: string;
};

export type WidgetIconInput =
  | string
  | { svgPath: string }
  | { componentKey: string };

export type NormalizedWidgetIcon =
  | { kind: 'text'; value: string }
  | { kind: 'svgPath'; value: string }
  | { kind: 'component'; value: string };

export type WidgetManifest = {
  id: string;
  envName?: string;
  name: string;
  version: string;
  description: string;
  headerName: WidgetHeaderName;
  icon: WidgetIconInput;
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

export type WidgetRouteContext = {
  request: Request;
  agentId: string;
  action: string;
  actionSegments: string[];
  params: {
    id: string;
  };
};

export type WidgetRouteHandler = (context: WidgetRouteContext) => Promise<Response> | Response;

export type WidgetServerModule = {
  handlers: Record<string, WidgetRouteHandler>;
  init?: () =>
    | Promise<{ ready: boolean; reason?: string } | undefined>
    | { ready: boolean; reason?: string }
    | undefined;
};

export type WidgetRenderProps = {
  locale: DisplayLocale;
  theme: ResolvedShellTheme;
  platform: HostPlatform;
};

export type WidgetClientModule = {
  manifest: WidgetManifest;
  Render: ComponentType<WidgetRenderProps>;
  Icon: ComponentType;
  normalizedIcon: NormalizedWidgetIcon;
};

export type RegisteredWidgetModule = WidgetClientModule & {
  loadServerModule: () => Promise<WidgetServerModule>;
};

export type WidgetDescriptor = {
  module: RegisteredWidgetModule;
  runtime: WidgetRuntimeState;
};

export type WidgetModuleInfo = {
  id: string;
  name: string;
  version: string;
  description: string;
  headerName: WidgetHeaderName;
  normalizedIcon: NormalizedWidgetIcon;
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
  locale: ShellLocale;
  theme: ShellTheme;
};

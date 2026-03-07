import type { ComponentType } from 'react';
import type {
  RegisteredWidgetModule,
  WidgetClientModule,
  WidgetIconInput,
  WidgetManifest,
  WidgetRenderProps,
  WidgetServerModule
} from './types';

function normalizeIcon(icon: WidgetIconInput): WidgetClientModule['normalizedIcon'] {
  if (typeof icon === 'string') {
    return {
      kind: 'text',
      value: icon
    };
  }

  if ('svgPath' in icon) {
    return {
      kind: 'svgPath',
      value: icon.svgPath
    };
  }

  return {
    kind: 'component',
    value: icon.componentKey
  };
}

function createIconComponent(normalizedIcon: WidgetClientModule['normalizedIcon']): ComponentType {
  if (normalizedIcon.kind === 'svgPath') {
    return function SvgIcon() {
      return <img src={normalizedIcon.value} alt="" width={24} height={24} />;
    };
  }

  if (normalizedIcon.kind === 'component') {
    return function ComponentKeyIcon() {
      return <span>{normalizedIcon.value}</span>;
    };
  }

  return function TextIcon() {
    return <span>{normalizedIcon.value}</span>;
  };
}

export function defineWidgetModule(input: {
  manifest: WidgetManifest;
  Render: ComponentType<WidgetRenderProps>;
  loadServerModule: () => Promise<WidgetServerModule>;
}): RegisteredWidgetModule {
  return {
    ...defineWidgetClientModule(input),
    loadServerModule: input.loadServerModule
  };
}

export function defineWidgetClientModule(input: {
  manifest: WidgetManifest;
  Render: ComponentType<WidgetRenderProps>;
}): WidgetClientModule {
  const normalizedIcon = normalizeIcon(input.manifest.icon);

  return {
    manifest: input.manifest,
    Render: input.Render,
    Icon: createIconComponent(normalizedIcon),
    normalizedIcon
  };
}

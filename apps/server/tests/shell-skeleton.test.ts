import { describe, expect, it } from 'vitest';
import { buildShellSkeletonLayout } from '../src/app/shell/model/skeleton';
import type { WidgetClientModule, WidgetModuleInfo } from '../src/entities/widget/model/types';

function createRegistryModule(
  id: string,
  defaultSize: 'small' | 'medium' | 'large'
): WidgetClientModule {
  return {
    manifest: {
      id,
      name: id,
      version: '1.0.0',
      description: id,
      headerName: { ru: id, en: id },
      icon: 'x',
      ready: true,
      defaultSize,
      supportedSizes: ['small', 'medium', 'large'],
      capabilities: [],
      channels: []
    },
    Render: (() => null) as WidgetClientModule['Render'],
    Icon: (() => null) as WidgetClientModule['Icon'],
    normalizedIcon: { kind: 'text', value: 'x' }
  };
}

function createModuleInfo(id: string, enabled: boolean): WidgetModuleInfo {
  return {
    id,
    name: id,
    version: '1.0.0',
    description: id,
    headerName: { ru: id, en: id },
    normalizedIcon: { kind: 'text', value: 'x' },
    ready: true,
    enabled,
    notReadyReasons: [],
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large']
  };
}

describe('buildShellSkeletonLayout', () => {
  it('falls back to registry defaults before shell data is loaded', () => {
    const result = buildShellSkeletonLayout(
      [],
      [],
      [createRegistryModule('weather', 'medium'), createRegistryModule('transcribe', 'large')]
    );

    expect(result).toEqual([
      { widgetId: 'weather', order: 0, size: 'medium' },
      { widgetId: 'transcribe', order: 1, size: 'large' }
    ]);
  });

  it('uses visible saved layout once shell modules are loaded', () => {
    const result = buildShellSkeletonLayout(
      [
        { widgetId: 'transcribe', order: 1, size: 'large' },
        { widgetId: 'weather', order: 0, size: 'small' }
      ],
      [createModuleInfo('weather', true), createModuleInfo('transcribe', false)],
      [createRegistryModule('weather', 'medium'), createRegistryModule('transcribe', 'large')]
    );

    expect(result).toEqual([{ widgetId: 'weather', order: 0, size: 'small' }]);
  });
});

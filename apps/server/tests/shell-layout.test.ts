import { describe, expect, it } from 'vitest';
import type { LayoutItem, WidgetModuleInfo } from '../src/entities/widget/model/types';
import {
  buildPreviewLayout,
  getVisibleLayout,
  mergeVisibleAndHiddenLayout,
  normalizeLayout,
  reorderVisibleLayout
} from '../src/app/shell/model/layout';
import { TRANSCRIBE_WIDGET_ID, WEATHER_WIDGET_ID } from '../src/widgets';

const modules: WidgetModuleInfo[] = [
  {
    id: WEATHER_WIDGET_ID,
    name: 'Weather',
    version: '1.0.0',
    description: 'Weather widget',
    headerName: { ru: 'Погода', en: 'Weather' },
    normalizedIcon: { kind: 'text', value: '🌤️' },
    ready: true,
    enabled: true,
    notReadyReasons: [],
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large']
  },
  {
    id: TRANSCRIBE_WIDGET_ID,
    name: 'Transcribe',
    version: '1.0.0',
    description: 'Transcribe widget',
    headerName: { ru: 'Транскрибация', en: 'Transcribe' },
    normalizedIcon: { kind: 'text', value: '🎙️' },
    ready: true,
    enabled: true,
    notReadyReasons: [],
    defaultSize: 'large',
    supportedSizes: ['medium', 'large']
  }
];

describe('shell layout helpers', () => {
  it('normalizeLayout removes duplicates and invalid rows', () => {
    const layout: LayoutItem[] = [
      { widgetId: WEATHER_WIDGET_ID, order: 0, size: 'medium' },
      { widgetId: WEATHER_WIDGET_ID, order: 1, size: 'large' },
      { widgetId: 'unknown', order: 2, size: 'small' }
    ];

    expect(normalizeLayout(layout, modules)).toEqual([
      { widgetId: WEATHER_WIDGET_ID, order: 0, size: 'medium' },
      { widgetId: TRANSCRIBE_WIDGET_ID, order: 1, size: 'large' }
    ]);
  });

  it('buildPreviewLayout inserts placeholder before over widget', () => {
    const layout: LayoutItem[] = [
      { widgetId: WEATHER_WIDGET_ID, order: 0, size: 'medium' },
      { widgetId: TRANSCRIBE_WIDGET_ID, order: 1, size: 'large' }
    ];

    expect(buildPreviewLayout(layout, TRANSCRIBE_WIDGET_ID, WEATHER_WIDGET_ID)).toEqual([
      { kind: 'placeholder', item: { widgetId: TRANSCRIBE_WIDGET_ID, order: 1, size: 'large' } },
      { kind: 'widget', item: { widgetId: WEATHER_WIDGET_ID, order: 0, size: 'medium' } }
    ]);
  });

  it('reorderVisibleLayout moves only visible widgets and preserves hidden tail', () => {
    const draftLayout: LayoutItem[] = [
      { widgetId: WEATHER_WIDGET_ID, order: 0, size: 'medium' },
      { widgetId: TRANSCRIBE_WIDGET_ID, order: 1, size: 'large' },
      { widgetId: 'com.hidden.widget', order: 2, size: 'small' }
    ];
    const visibleLayout = getVisibleLayout(draftLayout, [WEATHER_WIDGET_ID, TRANSCRIBE_WIDGET_ID]);

    expect(reorderVisibleLayout(draftLayout, visibleLayout, TRANSCRIBE_WIDGET_ID, WEATHER_WIDGET_ID)).toEqual([
      { widgetId: TRANSCRIBE_WIDGET_ID, order: 0, size: 'large' },
      { widgetId: WEATHER_WIDGET_ID, order: 1, size: 'medium' },
      { widgetId: 'com.hidden.widget', order: 2, size: 'small' }
    ]);
  });

  it('mergeVisibleAndHiddenLayout appends hidden widgets after visible ones', () => {
    const currentDraft: LayoutItem[] = [
      { widgetId: 'one', order: 0, size: 'small' },
      { widgetId: 'two', order: 1, size: 'medium' },
      { widgetId: 'hidden', order: 2, size: 'large' }
    ];

    expect(
      mergeVisibleAndHiddenLayout(currentDraft, [
        { widgetId: 'two', order: 0, size: 'medium' },
        { widgetId: 'one', order: 1, size: 'small' }
      ])
    ).toEqual([
      { widgetId: 'two', order: 0, size: 'medium' },
      { widgetId: 'one', order: 1, size: 'small' },
      { widgetId: 'hidden', order: 2, size: 'large' }
    ]);
  });
});

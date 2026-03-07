import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShellSettingsResponse } from '../src/app/shell/model/types';
import { createShellStore } from '../src/app/shell/model/store';
import * as shellApi from '../src/app/shell/lib/api';

vi.mock('../src/app/shell/lib/api', () => ({
  fetchShellSettings: vi.fn(),
  saveShellLayout: vi.fn(),
  toggleModule: vi.fn()
}));

function createResponse(overrides?: Partial<ShellSettingsResponse>): ShellSettingsResponse {
  return {
    platform: 'windows',
    layoutSettings: {
      desktopColumns: 12,
      mobileColumns: 1,
      locale: 'system',
      theme: 'auto'
    },
    layout: [
      { widgetId: 'com.yulia.weather', order: 0, size: 'medium' },
      { widgetId: 'com.yulia.transcribe', order: 1, size: 'large' }
    ],
    modules: [
      {
        id: 'com.yulia.weather',
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
        id: 'com.yulia.transcribe',
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
    ],
    ...overrides
  };
}

describe('shell store', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loadShell syncs server state and draft state', async () => {
    vi.mocked(shellApi.fetchShellSettings).mockResolvedValue(createResponse());
    const store = createShellStore();

    await store.getState().loadShell();

    expect(store.getState().layout).toEqual(createResponse().layout);
    expect(store.getState().draftLayout).toEqual(createResponse().layout);
    expect(store.getState().layoutSettings.locale).toBe('system');
    expect(store.getState().layoutSettings.theme).toBe('auto');
  });

  it('startEdit and cancelEdit preserve original layout', async () => {
    vi.mocked(shellApi.fetchShellSettings).mockResolvedValue(createResponse());
    const store = createShellStore();
    await store.getState().loadShell();

    store.getState().startEdit();
    store.getState().changeWidgetSize('com.yulia.weather', 'small');
    store.getState().cancelEdit();

    expect(store.getState().isEditMode).toBe(false);
    expect(store.getState().draftLayout).toEqual(store.getState().layout);
  });

  it('saveLayout persists draft layout and exits edit mode', async () => {
    vi.mocked(shellApi.fetchShellSettings).mockResolvedValue(createResponse());
    vi.mocked(shellApi.saveShellLayout).mockResolvedValue(
      createResponse({
        layout: [
          { widgetId: 'com.yulia.transcribe', order: 0, size: 'large' },
          { widgetId: 'com.yulia.weather', order: 1, size: 'medium' }
        ]
      })
    );

    const store = createShellStore();
    await store.getState().loadShell();
    store.getState().startEdit();
    store.getState().startDrag('com.yulia.transcribe');
    store.getState().overDrag('com.yulia.weather');
    store.getState().endDrag();
    await store.getState().saveLayout();

    expect(store.getState().isEditMode).toBe(false);
    expect(store.getState().layout[0]?.widgetId).toBe('com.yulia.transcribe');
  });

  it('openSettings, closeSettings and saveSettings work with draft values', async () => {
    vi.mocked(shellApi.fetchShellSettings).mockResolvedValue(createResponse());
    vi.mocked(shellApi.saveShellLayout).mockResolvedValue(
      createResponse({
        layoutSettings: {
          desktopColumns: 10,
          mobileColumns: 2,
          locale: 'en',
          theme: 'night'
        }
      })
    );

    const store = createShellStore();
    await store.getState().loadShell();
    store.getState().openSettings();
    store.getState().updateSettingsDraftColumns({ desktopColumns: 10, mobileColumns: 2 });
    store.getState().updateSettingsDraftLocale('en');
    store.getState().updateSettingsDraftTheme('night');
    await store.getState().saveSettings();

    expect(store.getState().isSettingsOpen).toBe(false);
    expect(store.getState().layoutSettings).toEqual({
      desktopColumns: 10,
      mobileColumns: 2,
      locale: 'en',
      theme: 'night'
    });
  });

  it('toggleTheme persists next theme', async () => {
    vi.mocked(shellApi.fetchShellSettings).mockResolvedValue(createResponse());
    vi.mocked(shellApi.saveShellLayout).mockResolvedValue(
      createResponse({
        layoutSettings: {
          desktopColumns: 12,
          mobileColumns: 1,
          locale: 'system',
          theme: 'day'
        }
      })
    );

    const store = createShellStore();
    await store.getState().loadShell();
    await store.getState().toggleTheme();

    expect(store.getState().layoutSettings.theme).toBe('day');
  });

  it('toggleLocale persists next locale', async () => {
    vi.mocked(shellApi.fetchShellSettings).mockResolvedValue(createResponse());
    vi.mocked(shellApi.saveShellLayout).mockResolvedValue(
      createResponse({
        layoutSettings: {
          desktopColumns: 12,
          mobileColumns: 1,
          locale: 'en',
          theme: 'auto'
        }
      })
    );

    const store = createShellStore();
    await store.getState().loadShell();
    await store.getState().toggleLocale();

    expect(store.getState().layoutSettings.locale).toBe('en');
  });

  it('toggleModule reloads shell state', async () => {
    vi.mocked(shellApi.toggleModule).mockResolvedValue({ module: {} });
    vi.mocked(shellApi.fetchShellSettings)
      .mockResolvedValueOnce(createResponse())
      .mockResolvedValueOnce(
        createResponse({
          modules: [
            {
              ...createResponse().modules[0],
              enabled: false
            },
            createResponse().modules[1]
          ]
        })
      );

    const store = createShellStore();
    await store.getState().loadShell();
    await store.getState().toggleModule('com.yulia.weather', false);

    expect(store.getState().modules[0]?.enabled).toBe(false);
  });

  it('drag actions update reorder state and reset active drag ids', async () => {
    vi.mocked(shellApi.fetchShellSettings).mockResolvedValue(createResponse());
    const store = createShellStore();
    await store.getState().loadShell();
    store.getState().startEdit();

    store.getState().startDrag('com.yulia.transcribe');
    store.getState().overDrag('com.yulia.weather');
    store.getState().endDrag();

    expect(store.getState().draftLayout[0]?.widgetId).toBe('com.yulia.transcribe');
    expect(store.getState().activeId).toBeNull();
    expect(store.getState().overId).toBeNull();
  });

  it('tickNow updates shared shell clock value', () => {
    const store = createShellStore();
    store.getState().tickNow('2026-03-07T12:00:00.000Z');

    expect(store.getState().nowIso).toBe('2026-03-07T12:00:00.000Z');
  });
});

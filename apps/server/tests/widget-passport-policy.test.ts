import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolvePassportRequestContextMock = vi.hoisted(() => vi.fn());
const listShellModulesMock = vi.hoisted(() => vi.fn());
const resolveWidgetHandlerMock = vi.hoisted(() => vi.fn());

vi.mock('../src/domains/passport/server/context', () => ({
  resolvePassportRequestContext: resolvePassportRequestContextMock
}));

vi.mock('../src/core/services/shell-service', () => ({
  listShellModules: listShellModulesMock
}));

vi.mock('../src/core/registry/registry', () => ({
  resolveWidgetHandler: resolveWidgetHandlerMock
}));

import { GET as widgetGet } from '../src/pages/api/widget/[id]/[...action]';

const WEATHER_WIDGET_ID = 'com.yulia.weather';
const TRANSCRIBE_WIDGET_ID = 'com.yulia.transcribe';
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_UNAUTHORIZED = 401;

describe('widget passport policy', () => {
  beforeEach(() => {
    resolvePassportRequestContextMock.mockReset();
    listShellModulesMock.mockReset();
    resolveWidgetHandlerMock.mockReset();
  });

  it('allows weather route without passport context', async () => {
    resolvePassportRequestContextMock.mockResolvedValue({
      context: null,
      reason: 'missing'
    });
    listShellModulesMock.mockResolvedValue([
      {
        id: WEATHER_WIDGET_ID,
        ready: true,
        enabled: true
      }
    ]);
    resolveWidgetHandlerMock.mockResolvedValue({
      handler: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: HTTP_STATUS_OK }))
    });

    const response = await widgetGet({
      request: new Request(`http://localhost/api/widget/${WEATHER_WIDGET_ID}/forecast`),
      params: {
        id: WEATHER_WIDGET_ID,
        action: 'forecast'
      }
    } as never);

    expect(response.status).toBe(HTTP_STATUS_OK);
    expect(listShellModulesMock).toHaveBeenCalledTimes(1);
  });

  it('blocks transcribe route without passport context', async () => {
    resolvePassportRequestContextMock.mockResolvedValue({
      context: null,
      reason: 'missing'
    });

    const response = await widgetGet({
      request: new Request(`http://localhost/api/widget/${TRANSCRIBE_WIDGET_ID}/settings`),
      params: {
        id: TRANSCRIBE_WIDGET_ID,
        action: 'settings'
      }
    } as never);

    expect(response.status).toBe(HTTP_STATUS_UNAUTHORIZED);
    expect(listShellModulesMock).not.toHaveBeenCalled();
  });
});

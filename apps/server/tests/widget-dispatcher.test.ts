import { describe, expect, it } from 'vitest';
import { resolveWidgetHandler } from '../src/core/registry/registry';
import { TERMINAL_AGENT_WIDGET_ID, WEATHER_WIDGET_ID } from '@/widgets';

describe('widget dispatcher registry', () => {
  it('finds weather forecast handler', async () => {
    const resolved = await resolveWidgetHandler(WEATHER_WIDGET_ID, 'GET', 'forecast');

    expect(resolved).not.toBeNull();
    expect(resolved?.ready).toBe(true);
  });

  it('returns null for unknown route', async () => {
    const resolved = await resolveWidgetHandler(WEATHER_WIDGET_ID, 'GET', 'unknown-action');
    expect(resolved).toBeNull();
  });

  it('finds terminal-agent settings handler', async () => {
    const resolved = await resolveWidgetHandler(TERMINAL_AGENT_WIDGET_ID, 'GET', 'settings');

    expect(resolved).not.toBeNull();
  });
});

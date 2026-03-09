import { describe, expect, it } from 'vitest';
import { resolveWidgetHandler } from '../src/core/registry/registry';

describe('widget dispatcher registry', () => {
  it('finds weather forecast handler', async () => {
    const resolved = await resolveWidgetHandler('com.yulia.weather', 'GET', 'forecast');

    expect(resolved).not.toBeNull();
    expect(resolved?.ready).toBe(true);
  });

  it('returns null for unknown route', async () => {
    const resolved = await resolveWidgetHandler('com.yulia.weather', 'GET', 'unknown-action');
    expect(resolved).toBeNull();
  });

  it('finds terminal-agent settings handler', async () => {
    const resolved = await resolveWidgetHandler('com.yulia.terminal-agent', 'GET', 'settings');

    expect(resolved).not.toBeNull();
  });
});

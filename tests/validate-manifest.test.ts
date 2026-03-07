import { describe, expect, it } from 'vitest';
import { validateWidgetManifest } from '../src/entities/widget/model/validate-manifest';

describe('validateWidgetManifest', () => {
  it('accepts valid manifest', () => {
    const reasons = validateWidgetManifest({
      widgetId: 'com.test.weather',
      name: 'Weather',
      version: '1.2.3',
      description: 'A widget',
      ready: true,
      defaultSize: 'medium',
      supportedSizes: ['small', 'medium', 'large'],
      capabilities: [],
      channels: []
    });

    expect(reasons).toEqual([]);
  });

  it('returns reasons for invalid fields', () => {
    const reasons = validateWidgetManifest({
      widgetId: '',
      name: '',
      version: '1.2',
      description: '',
      ready: true,
      defaultSize: 'medium',
      supportedSizes: ['medium', 'huge' as 'medium'],
      capabilities: [],
      channels: []
    });

    expect(reasons).toContain('Missing widgetId.');
    expect(reasons).toContain('Missing widget name.');
    expect(reasons).toContain('version must be x.y.z.');
    expect(reasons).toContain('description is required.');
    expect(reasons.some((reason) => reason.includes('Unsupported size'))).toBe(true);
  });
});

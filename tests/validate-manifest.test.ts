import { describe, expect, it } from 'vitest';
import { validateWidgetManifest } from '../src/entities/widget/model/validate-manifest';

describe('validateWidgetManifest', () => {
  it('accepts valid manifest', () => {
    const reasons = validateWidgetManifest({
      id: 'com.test.weather',
      name: 'Weather',
      version: '1.2.3',
      description: 'A widget',
      headerName: {
        ru: 'Погода',
        en: 'Weather'
      },
      icon: '🌤️',
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
      id: '',
      name: '',
      version: '1.2',
      description: '',
      headerName: {
        ru: '',
        en: ''
      },
      icon: { componentKey: '' },
      ready: true,
      defaultSize: 'medium',
      supportedSizes: ['medium', 'huge' as 'medium'],
      capabilities: [],
      channels: []
    });

    expect(reasons).toContain('Missing widget id.');
    expect(reasons).toContain('Missing widget name.');
    expect(reasons).toContain('version must be x.y.z.');
    expect(reasons).toContain('description is required.');
    expect(reasons).toContain('headerName.ru is required.');
    expect(reasons).toContain('headerName.en is required.');
    expect(reasons).toContain('icon must be a non-empty string, svgPath, or componentKey.');
    expect(reasons.some((reason) => reason.includes('Unsupported size'))).toBe(true);
  });
});

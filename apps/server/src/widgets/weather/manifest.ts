import type { WidgetManifest } from '../../entities/widget/model/types';

export const weatherManifest: WidgetManifest = {
  id: 'com.yulia.weather',
  name: 'Weather',
  version: '1.0.0',
  description: 'Batumi weather widget with server cache.',
  headerName: {
    ru: 'Погода',
    en: 'Weather'
  },
  icon: '🌤️',
  ready: true,
  defaultSize: 'medium',
  supportedSizes: ['small', 'medium', 'large'],
  capabilities: ['forecast', 'cache', 'refresh'],
  channels: ['bus', 'webhook', 'ws']
};

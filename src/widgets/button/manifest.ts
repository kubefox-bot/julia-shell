import type { WidgetManifest } from '../../entities/widget/model/types';

export const buttonManifest: WidgetManifest = {
  id: 'com.yulia.button',
  name: 'Button',
  version: '1.0.0',
  description: 'Simple shell button widget for registry testing.',
  headerName: {
    ru: 'Кнопка',
    en: 'Button'
  },
  icon: '🔘',
  ready: true,
  defaultSize: 'small',
  supportedSizes: ['small', 'medium'],
  capabilities: ['ui'],
  channels: ['bus']
};

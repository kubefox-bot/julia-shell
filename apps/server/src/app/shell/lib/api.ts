import type { LayoutItem } from '@/entities/widget/model/types';
import type { ShellSettingsResponse } from '../model/types';
import { defineQuery, requestJson } from '@shared/lib/request'

export const shellQueryKeys = {
  settings: () => ['shell', 'settings'] as const,
}

export async function fetchShellSettings() {
  return requestJson<ShellSettingsResponse>('/api/shell/settings')
}

export async function saveShellLayout(payload: {
  desktopColumns: number;
  mobileColumns: number;
  locale: 'ru' | 'en';
  theme: 'auto' | 'day' | 'night';
  layout: LayoutItem[];
}) {
  return requestJson<ShellSettingsResponse>('/api/shell/settings/layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

export async function toggleModule(widgetId: string, enabled: boolean) {
  return requestJson<{ module: unknown }>(`/api/shell/modules/${encodeURIComponent(widgetId)}/${enabled ? 'enable' : 'disable'}`, {
    method: 'POST'
  })
}

export const shellSettingsQuery = defineQuery(shellQueryKeys.settings(), fetchShellSettings)

import type { LayoutItem } from '../../../entities/widget/model/types';
import type { ShellSettingsResponse } from '../model/types';
import { fetchWithRequestHeaders } from '@shared/lib/request-headers'

async function safeJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { error?: string })?.error ?? `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function fetchShellSettings() {
  const response = await fetchWithRequestHeaders('/api/shell/settings')
  return safeJson<ShellSettingsResponse>(response);
}

export async function saveShellLayout(payload: {
  desktopColumns: number;
  mobileColumns: number;
  locale: 'ru' | 'en';
  theme: 'auto' | 'day' | 'night';
  layout: LayoutItem[];
}) {
  const response = await fetchWithRequestHeaders('/api/shell/settings/layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  return safeJson<ShellSettingsResponse>(response);
}

export async function toggleModule(widgetId: string, enabled: boolean) {
  const response = await fetchWithRequestHeaders(`/api/shell/modules/${encodeURIComponent(widgetId)}/${enabled ? 'enable' : 'disable'}`, {
    method: 'POST'
  })

  return safeJson<{ module: unknown }>(response);
}

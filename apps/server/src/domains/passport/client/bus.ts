import type { PassportAuthStatus } from './types';

export type PassportStatusChangedDetail = {
  status: PassportAuthStatus;
  updatedAt: string;
  reason?: string | null;
};

export const PASSPORT_STATUS_CHANGED_EVENT = 'yulia:passport-status-changed';

export function dispatchPassportStatusChanged(detail: PassportStatusChangedDetail) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<PassportStatusChangedDetail>(PASSPORT_STATUS_CHANGED_EVENT, { detail }));
}

export function subscribePassportStatusChanged(
  listener: (detail: PassportStatusChangedDetail) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<PassportStatusChangedDetail>;
    if (!customEvent.detail) {
      return;
    }

    listener(customEvent.detail);
  };

  window.addEventListener(PASSPORT_STATUS_CHANGED_EVENT, handler);
  return () => {
    window.removeEventListener(PASSPORT_STATUS_CHANGED_EVENT, handler);
  };
}

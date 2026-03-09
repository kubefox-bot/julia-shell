import { PASSPORT_WIDGET_ID_TRANSCRIBE } from './consts';

const PASSPORT_PROTECTED_WIDGET_IDS = new Set([PASSPORT_WIDGET_ID_TRANSCRIBE]);

/**
 * Returns true when widget actions must be gated by passport access token.
 */
export function isPassportProtectedWidget(widgetId: string) {
  return PASSPORT_PROTECTED_WIDGET_IDS.has(widgetId);
}

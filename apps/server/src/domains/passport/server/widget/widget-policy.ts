import { PASSPORT_WIDGET_ID_TERMINAL_AGENT, PASSPORT_WIDGET_ID_TRANSCRIBE } from '../config/consts';

const PASSPORT_PROTECTED_WIDGET_IDS = new Set([
  PASSPORT_WIDGET_ID_TRANSCRIBE,
  PASSPORT_WIDGET_ID_TERMINAL_AGENT,
]);

/**
 * Returns true when widget actions must be gated by passport access token.
 */
export function isPassportProtectedWidget(widgetId: string) {
  return PASSPORT_PROTECTED_WIDGET_IDS.has(widgetId);
}

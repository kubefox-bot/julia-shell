import { TERMINAL_AGENT_WIDGET_ID, TRANSCRIBE_WIDGET_ID } from '@/widgets';

const PASSPORT_PROTECTED_WIDGET_IDS = new Set([
  TRANSCRIBE_WIDGET_ID,
  TERMINAL_AGENT_WIDGET_ID,
]);

/**
 * Returns true when widget actions must be gated by passport access token.
 */
export function isPassportProtectedWidget(widgetId: string) {
  return PASSPORT_PROTECTED_WIDGET_IDS.has(widgetId);
}

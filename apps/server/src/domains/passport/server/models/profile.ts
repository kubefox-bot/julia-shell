import {
  PASSPORT_DEFAULT_AGENT_DISPLAY_NAME,
  PASSPORT_DEFAULT_AGENT_VERSION
} from './consts';

export function resolveAgentDisplayName(value: unknown) {
  const parsed = typeof value === 'string' ? value.trim() : '';
  return parsed || PASSPORT_DEFAULT_AGENT_DISPLAY_NAME;
}

export function resolveAgentVersion(value: unknown) {
  const parsed = typeof value === 'string' ? value.trim() : '';
  return parsed || PASSPORT_DEFAULT_AGENT_VERSION;
}

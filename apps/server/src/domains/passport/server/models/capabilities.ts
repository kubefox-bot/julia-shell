import { z } from 'zod';

const capabilitiesSchema = z
  .array(z.string())
  .transform((items) => items.map((item) => item.trim()).filter(Boolean))
  .catch([]);

/**
 * Normalizes capability list from unknown input.
 */
export function normalizeAgentCapabilities(value: unknown) {
  return capabilitiesSchema.parse(value);
}

/**
 * Serializes normalized capabilities for repository persistence.
 */
export function serializeAgentCapabilities(value: unknown) {
  return JSON.stringify(normalizeAgentCapabilities(value));
}

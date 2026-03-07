import type { WidgetManifest } from './types';

const VERSION_RE = /^\d+\.\d+\.\d+$/;
const SIZE_SET = new Set(['small', 'medium', 'large']);

export function validateWidgetManifest(manifest: WidgetManifest): string[] {
  const reasons: string[] = [];

  if (!manifest.widgetId?.trim()) {
    reasons.push('Missing widgetId.');
  }

  if (!manifest.name?.trim()) {
    reasons.push('Missing widget name.');
  }

  if (!VERSION_RE.test(manifest.version ?? '')) {
    reasons.push('version must be x.y.z.');
  }

  if (!manifest.description?.trim()) {
    reasons.push('description is required.');
  }

  if (typeof manifest.ready !== 'boolean') {
    reasons.push('ready must be boolean.');
  }

  if (!SIZE_SET.has(manifest.defaultSize)) {
    reasons.push('defaultSize must be one of: small, medium, large.');
  }

  if (!Array.isArray(manifest.supportedSizes) || manifest.supportedSizes.length === 0) {
    reasons.push('supportedSizes must contain at least one size.');
  } else {
    for (const size of manifest.supportedSizes) {
      if (!SIZE_SET.has(size)) {
        reasons.push(`Unsupported size in supportedSizes: ${size}`);
      }
    }
  }

  if (!Array.isArray(manifest.capabilities)) {
    reasons.push('capabilities must be an array.');
  }

  if (!Array.isArray(manifest.channels)) {
    reasons.push('channels must be an array.');
  }

  return reasons;
}

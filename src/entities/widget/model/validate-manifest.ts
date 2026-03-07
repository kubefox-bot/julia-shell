import type { WidgetManifest } from './types';

const VERSION_RE = /^\d+\.\d+\.\d+$/;
const SIZE_SET = new Set(['small', 'medium', 'large']);

function isValidIcon(manifest: WidgetManifest) {
  if (typeof manifest.icon === 'string') {
    return manifest.icon.trim().length > 0;
  }

  if ('svgPath' in manifest.icon) {
    return typeof manifest.icon.svgPath === 'string' && manifest.icon.svgPath.trim().length > 0;
  }

  if ('componentKey' in manifest.icon) {
    return typeof manifest.icon.componentKey === 'string' && manifest.icon.componentKey.trim().length > 0;
  }

  return false;
}

export function validateWidgetManifest(manifest: WidgetManifest): string[] {
  const reasons: string[] = [];

  if (!manifest.id?.trim()) {
    reasons.push('Missing widget id.');
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

  if (!manifest.headerName?.ru?.trim()) {
    reasons.push('headerName.ru is required.');
  }

  if (!manifest.headerName?.en?.trim()) {
    reasons.push('headerName.en is required.');
  }

  if (typeof manifest.ready !== 'boolean') {
    reasons.push('ready must be boolean.');
  }

  if (!isValidIcon(manifest)) {
    reasons.push('icon must be a non-empty string, svgPath, or componentKey.');
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

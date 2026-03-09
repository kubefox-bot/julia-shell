import type { WidgetManifest } from './types';

const VERSION_RE = /^\d+\.\d+\.\d+$/;
const SIZE_SET = new Set(['small', 'medium', 'large']);
const ENV_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;

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

function validateSupportedSizes(manifest: WidgetManifest, reasons: string[]) {
  if (!Array.isArray(manifest.supportedSizes) || manifest.supportedSizes.length === 0) {
    reasons.push('supportedSizes must contain at least one size.');
    return;
  }

  for (const size of manifest.supportedSizes) {
    if (!SIZE_SET.has(size)) {
      reasons.push(`Unsupported size in supportedSizes: ${size}`);
    }
  }
}

function validateEnvName(manifest: WidgetManifest, reasons: string[]) {
  if (typeof manifest.envName !== 'string' || !manifest.envName.trim()) {
    return;
  }

  if (!ENV_NAME_RE.test(manifest.envName)) {
    reasons.push('envName must contain only letters, numbers, underscore, or dash.');
  }
}

export function validateWidgetManifest(manifest: WidgetManifest): string[] {
  const reasons: string[] = [];

  validateEnvName(manifest, reasons);

  const requiredChecks: Array<{ invalid: boolean; message: string }> = [
    { invalid: !manifest.id?.trim(), message: 'Missing widget id.' },
    { invalid: !manifest.name?.trim(), message: 'Missing widget name.' },
    { invalid: !VERSION_RE.test(manifest.version ?? ''), message: 'version must be x.y.z.' },
    { invalid: !manifest.description?.trim(), message: 'description is required.' },
    { invalid: !manifest.headerName?.ru?.trim(), message: 'headerName.ru is required.' },
    { invalid: !manifest.headerName?.en?.trim(), message: 'headerName.en is required.' },
    { invalid: typeof manifest.ready !== 'boolean', message: 'ready must be boolean.' },
    { invalid: !SIZE_SET.has(manifest.defaultSize), message: 'defaultSize must be one of: small, medium, large.' },
    { invalid: !Array.isArray(manifest.capabilities), message: 'capabilities must be an array.' },
    { invalid: !Array.isArray(manifest.channels), message: 'channels must be an array.' },
  ];

  for (const check of requiredChecks) {
    if (check.invalid) {
      reasons.push(check.message);
    }
  }

  if (!isValidIcon(manifest)) {
    reasons.push('icon must be a non-empty string, svgPath, or componentKey.');
  }

  validateSupportedSizes(manifest, reasons);

  return reasons;
}

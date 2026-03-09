import { describe, expect, it } from 'vitest';
import { computeBootHeaderSpacerHeight } from '../src/app/shell/ui/lib/boot-overlay';

describe('boot overlay spacer math', () => {
  it('uses measured header and actions heights', () => {
    expect(computeBootHeaderSpacerHeight({ headerHeight: 80, actionsHeight: 42 })).toBe(122);
  });

  it('falls back to default actions height when actions are absent', () => {
    expect(computeBootHeaderSpacerHeight({ headerHeight: 80 })).toBe(136);
  });

  it('normalizes non-finite or negative values', () => {
    expect(computeBootHeaderSpacerHeight({ headerHeight: -10, actionsHeight: -20 })).toBe(0);
    expect(computeBootHeaderSpacerHeight({ headerHeight: Number.NaN, actionsHeight: Number.POSITIVE_INFINITY })).toBe(56);
  });
});

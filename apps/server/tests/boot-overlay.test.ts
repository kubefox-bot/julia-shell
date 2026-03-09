import { describe, expect, it } from 'vitest';
import { computeBootHeaderSpacerHeight } from '../src/app/shell/ui/lib/boot-overlay';

const HEADER_HEIGHT_PX = 80;
const ACTIONS_HEIGHT_PX = 42;
const COMBINED_HEIGHT_PX = 122;
const DEFAULT_ACTIONS_COMBINED_HEIGHT_PX = 136;
const ZERO_HEIGHT_PX = 0;
const FALLBACK_ACTIONS_ONLY_HEIGHT_PX = 56;

describe('boot overlay spacer math', () => {
  it('uses measured header and actions heights', () => {
    expect(
      computeBootHeaderSpacerHeight({ headerHeight: HEADER_HEIGHT_PX, actionsHeight: ACTIONS_HEIGHT_PX })
    ).toBe(COMBINED_HEIGHT_PX);
  });

  it('falls back to default actions height when actions are absent', () => {
    expect(computeBootHeaderSpacerHeight({ headerHeight: HEADER_HEIGHT_PX })).toBe(DEFAULT_ACTIONS_COMBINED_HEIGHT_PX);
  });

  it('normalizes non-finite or negative values', () => {
    expect(computeBootHeaderSpacerHeight({ headerHeight: -10, actionsHeight: -20 })).toBe(ZERO_HEIGHT_PX);
    expect(
      computeBootHeaderSpacerHeight({
        headerHeight: Number.NaN,
        actionsHeight: Number.POSITIVE_INFINITY
      })
    ).toBe(FALLBACK_ACTIONS_ONLY_HEIGHT_PX);
  });
});

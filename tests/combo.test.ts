import { describe, it, expect, beforeAll } from 'vitest';
import { readCss } from './helpers';

describe('combo.css — safe-area placement (SPEC §8.5 / §8.9)', () => {
  let css = '';
  let base = '';

  beforeAll(() => {
    css = readCss('combo.css');
    // The base `.combo-callout { ... }` rule (first block; not the keyframe).
    base = /\.combo-callout\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? '';
    expect(base).not.toBe('');
  });

  it('anchors the callout top within the safe box, never the raw inset zone', () => {
    expect(base).toMatch(
      /top:\s*max\(\s*var\(--screen-pad\)\s*,\s*env\(safe-area-inset-top\)\s*\)/,
    );
    // The old raw `top: var(--screen-pad);` (overlapped the camera) is gone.
    expect(base).not.toMatch(/top:\s*var\(--screen-pad\)\s*;/);
  });

  it('centres horizontally within the safe box (accounts for side cutouts)', () => {
    expect(base).toContain('env(safe-area-inset-left)');
    expect(base).toContain('env(safe-area-inset-right)');
    expect(base).toMatch(/left:\s*calc\(/);
  });

  it('keeps the existing translateX(-50%) centring transform', () => {
    expect(base).toMatch(/transform:\s*translateX\(-50%\)/);
  });

  it('inherits font-family from body (no duplicated declaration)', () => {
    expect(css).not.toContain('font-family');
  });
});

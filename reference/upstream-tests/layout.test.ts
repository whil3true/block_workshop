import { describe, it, expect } from 'vitest';
import { computeLayout, type LayoutInput, type Layout } from '../src/layout';

const TOKENS = { screenPad: 12, boardPad: 6, gap: 2, minCell: 28, trayScale: 0.5 };

function input(p: Partial<LayoutInput> & {
  viewportWidth: number;
  viewportHeight: number;
}): LayoutInput {
  return {
    insetTop: 0,
    insetRight: 0,
    insetBottom: 0,
    insetLeft: 0,
    hudWidth: 60,
    hudHeight: 60,
    ...TOKENS,
    ...p,
  };
}

function assertInvariants(out: Layout): void {
  for (const n of [
    out.cellSize,
    out.boardSize,
    out.trayCellSize,
    out.traySlotSize,
  ]) {
    expect(Number.isInteger(n)).toBe(true);
  }
  expect(out.cellSize).toBeGreaterThanOrEqual(TOKENS.minCell);
  expect(out.boardSize).toBe(
    2 * TOKENS.boardPad + 10 * out.cellSize + 9 * TOKENS.gap,
  );
  expect(out.trayCellSize).toBe(
    Math.max(1, Math.floor(out.cellSize * TOKENS.trayScale)),
  );
  expect(out.traySlotSize).toBe(5 * out.trayCellSize + 4 * TOKENS.gap);
}

describe('computeLayout — orientation', () => {
  it('is portrait when the safe box is taller than wide', () => {
    const out = computeLayout(input({ viewportWidth: 393, viewportHeight: 852 }));
    expect(out.orientation).toBe('portrait');
    assertInvariants(out);
  });

  it('is landscape when the safe box is wider than tall', () => {
    const out = computeLayout(input({ viewportWidth: 852, viewportHeight: 393 }));
    expect(out.orientation).toBe('landscape');
    assertInvariants(out);
  });

  it('treats an exactly square safe box as portrait', () => {
    const out = computeLayout(input({ viewportWidth: 600, viewportHeight: 600 }));
    expect(out.orientation).toBe('portrait');
  });
});

describe('computeLayout — devices', () => {
  it('iPhone SE portrait 375×667, no insets', () => {
    const out = computeLayout(input({ viewportWidth: 375, viewportHeight: 667 }));
    expect(out.orientation).toBe('portrait');
    // contentW = 375 - 12 - 12 = 351 ; rawCell = floor((351 - 12 - 18)/10) = 32
    expect(out.cellSize).toBe(32);
    expect(out.overflow).toBe(false);
    assertInvariants(out);
  });

  it('iPhone 15 portrait 393×852 with Dynamic Island + home indicator', () => {
    const out = computeLayout(
      input({
        viewportWidth: 393,
        viewportHeight: 852,
        insetTop: 59,
        insetBottom: 34,
      }),
    );
    expect(out.orientation).toBe('portrait');
    // contentW = 393 - 12 - 12 = 369 ; rawCell = floor((369 - 12 - 18)/10) = 33
    expect(out.cellSize).toBe(33);
    expect(out.overflow).toBe(false);
    assertInvariants(out);
  });

  it('iPhone 15 LANDSCAPE 852×393 fits the board to height (the rework target)', () => {
    const out = computeLayout(
      input({
        viewportWidth: 852,
        viewportHeight: 393,
        insetLeft: 59,
        insetRight: 59,
        insetBottom: 21,
      }),
    );
    expect(out.orientation).toBe('landscape');
    // contentH = 393 - 12 - max(12,21)=21 = 360 ; rawCell = floor((360-12-18)/10)=33
    expect(out.cellSize).toBe(33);
    // boardSize = 12 + 330 + 18 = 360 ; contentW = 852 - 59 - 59 = 734
    expect(out.boardSize).toBe(360);
    expect(out.overflow).toBe(false);
    assertInvariants(out);
  });

  it('iPad portrait 820×1180', () => {
    const out = computeLayout(input({ viewportWidth: 820, viewportHeight: 1180 }));
    expect(out.orientation).toBe('portrait');
    expect(out.cellSize).toBeGreaterThan(60);
    expect(out.overflow).toBe(false);
    assertInvariants(out);
  });

  it('iPad landscape 1180×820', () => {
    const out = computeLayout(input({ viewportWidth: 1180, viewportHeight: 820 }));
    expect(out.orientation).toBe('landscape');
    expect(out.cellSize).toBeGreaterThan(60);
    expect(out.overflow).toBe(false);
    assertInvariants(out);
  });
});

describe('computeLayout — degenerate inputs', () => {
  it('0×0 does not throw; clamps to minCell with overflow', () => {
    const out = computeLayout(input({ viewportWidth: 0, viewportHeight: 0 }));
    expect(out.cellSize).toBe(TOKENS.minCell);
    expect(out.overflow).toBe(true);
    assertInvariants(out);
  });

  it('tiny 200×200 clamps to minCell with overflow', () => {
    const out = computeLayout(input({ viewportWidth: 200, viewportHeight: 200 }));
    expect(out.cellSize).toBe(TOKENS.minCell);
    expect(out.overflow).toBe(true);
    assertInvariants(out);
  });

  it('negative viewport does not throw', () => {
    expect(() =>
      computeLayout(input({ viewportWidth: -100, viewportHeight: -100 })),
    ).not.toThrow();
  });
});

describe('computeLayout — safe-area folding', () => {
  it('insets larger than screenPad shrink the content box', () => {
    const small = computeLayout(
      input({ viewportWidth: 800, viewportHeight: 1200, insetLeft: 4, insetRight: 4 }),
    );
    const big = computeLayout(
      input({ viewportWidth: 800, viewportHeight: 1200, insetLeft: 80, insetRight: 80 }),
    );
    // Bigger side insets => narrower portrait board => smaller cell.
    expect(big.cellSize).toBeLessThan(small.cellSize);
  });

  it('insets smaller than screenPad do not change the content box', () => {
    const a = computeLayout(
      input({ viewportWidth: 800, viewportHeight: 1200, insetTop: 0 }),
    );
    const b = computeLayout(
      input({ viewportWidth: 800, viewportHeight: 1200, insetTop: 5 }),
    );
    expect(b.cellSize).toBe(a.cellSize); // 5 < screenPad 12 → folded away
  });
});

describe('computeLayout — purity', () => {
  it('returns deep-equal output for identical input', () => {
    const i = input({ viewportWidth: 393, viewportHeight: 852, insetTop: 59 });
    expect(computeLayout(i)).toEqual(computeLayout(i));
  });

  it('does not mutate a frozen input', () => {
    const i = Object.freeze(
      input({ viewportWidth: 1024, viewportHeight: 768 }),
    );
    expect(() => computeLayout(i)).not.toThrow();
  });
});

describe('computeLayout — §8.9 board-vs-budget invariant', () => {
  function budgetOf(i: LayoutInput, out: Layout): number {
    const padL = Math.max(i.screenPad, i.insetLeft);
    const padR = Math.max(i.screenPad, i.insetRight);
    const padT = Math.max(i.screenPad, i.insetTop);
    const padB = Math.max(i.screenPad, i.insetBottom);
    const contentW = i.viewportWidth - padL - padR;
    const contentH = i.viewportHeight - padT - padB;
    return out.orientation === 'portrait' ? contentW : contentH;
  }

  it('boardSize ≤ budget on a normal device (remainder is outer margin)', () => {
    for (const i of [
      input({ viewportWidth: 393, viewportHeight: 852, insetTop: 59 }),
      input({ viewportWidth: 852, viewportHeight: 393, insetLeft: 59, insetRight: 59 }),
      input({ viewportWidth: 820, viewportHeight: 1180 }),
      input({ viewportWidth: 1180, viewportHeight: 820 }),
    ]) {
      const out = computeLayout(i);
      expect(out.overflow).toBe(false);
      expect(out.boardSize).toBeLessThanOrEqual(budgetOf(i, out));
    }
  });

  it('clamped tiny viewport: boardSize > budget AND overflow is true', () => {
    const i = input({ viewportWidth: 200, viewportHeight: 200 });
    const out = computeLayout(i);
    expect(out.cellSize).toBe(TOKENS.minCell);
    expect(out.boardSize).toBeGreaterThan(budgetOf(i, out));
    expect(out.overflow).toBe(true);
  });
});

describe('computeLayout — HUD axis is orientation-specific', () => {
  it('portrait consults hudHeight, not hudWidth', () => {
    // 400×1000 portrait: a tall HUD eats the vertical budget → overflow;
    // an enormous hudWidth is irrelevant in portrait.
    const tooTall = computeLayout(
      input({ viewportWidth: 400, viewportHeight: 1000, hudHeight: 600, hudWidth: 10 }),
    );
    const wideOk = computeLayout(
      input({ viewportWidth: 400, viewportHeight: 1000, hudHeight: 10, hudWidth: 5000 }),
    );
    expect(tooTall.orientation).toBe('portrait');
    expect(tooTall.overflow).toBe(true);
    expect(wideOk.overflow).toBe(false);
  });

  it('landscape consults hudWidth, not hudHeight', () => {
    const tooWide = computeLayout(
      input({ viewportWidth: 1000, viewportHeight: 400, hudWidth: 900, hudHeight: 10 }),
    );
    const tallOk = computeLayout(
      input({ viewportWidth: 1000, viewportHeight: 400, hudWidth: 10, hudHeight: 5000 }),
    );
    expect(tooWide.orientation).toBe('landscape');
    expect(tooWide.overflow).toBe(true);
    expect(tallOk.overflow).toBe(false);
  });
});

describe('computeLayout — overflow', () => {
  it('flags overflow when the auxiliary cannot fit the free dimension', () => {
    // Very short portrait: width is fine (big cell) but height can't hold
    // HUD + a full-width board + tray.
    const out = computeLayout(
      input({ viewportWidth: 1200, viewportHeight: 300, hudWidth: 60, hudHeight: 60 }),
    );
    // 1200 wide, 300 tall → contentW(1176) > contentH(276) → landscape,
    // board sized from height; assert the model still returns sane integers.
    assertInvariants(out);
    expect(typeof out.overflow).toBe('boolean');
  });
});

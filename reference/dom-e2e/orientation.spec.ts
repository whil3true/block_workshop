import { test, expect } from '@playwright/test';

const cases = [
  { name: 'iPhone portrait', w: 393, h: 852, orient: 'portrait' },
  { name: 'iPhone landscape', w: 852, h: 393, orient: 'landscape' },
  { name: 'iPad portrait', w: 820, h: 1180, orient: 'portrait' },
  { name: 'iPad landscape', w: 1180, h: 820, orient: 'landscape' },
];

for (const c of cases) {
  test(`${c.name}: board fully visible, correct orientation`, async ({ page }) => {
    await page.setViewportSize({ width: c.w, height: c.h });
    await page.goto('/');
    await page.waitForSelector('.board');

    const app = page.locator('#app');
    await expect(app).toHaveAttribute('data-orientation', c.orient);

    const board = page.locator('.board');
    const tray = page.locator('.tray');
    const bb = await board.boundingBox();
    const tb = await tray.boundingBox();
    expect(bb).not.toBeNull();
    expect(tb).not.toBeNull();
    if (!bb || !tb) return;

    // Board fully within the viewport (never clipped / scrolled off, §8.9).
    expect(bb.x).toBeGreaterThanOrEqual(-0.5);
    expect(bb.y).toBeGreaterThanOrEqual(-0.5);
    expect(bb.x + bb.width).toBeLessThanOrEqual(c.w + 0.5);
    expect(bb.y + bb.height).toBeLessThanOrEqual(c.h + 0.5);
    // Board roughly square.
    expect(Math.abs(bb.width - bb.height)).toBeLessThan(2);
    // Tray visible within the viewport (reachable without scrolling).
    expect(tb.y + tb.height).toBeLessThanOrEqual(c.h + 0.5);
    expect(tb.x + tb.width).toBeLessThanOrEqual(c.w + 0.5);

    // In landscape the board is left of the tray; in portrait above it.
    if (c.orient === 'landscape') {
      expect(bb.x).toBeLessThan(tb.x);
    } else {
      expect(bb.y).toBeLessThan(tb.y);
    }

    // Iteration 28: the bottom row must be droppable without the finger
    // leaving the screen. Touch-drop hit-tests at finger − TOUCH_LIFT_PX (32),
    // so the finger position needed to target the bottom row is
    // bottomRowCenterY + 32 and must stay on-screen.
    const TOUCH_LIFT_PX = 32;
    const bottomCell = await page
      .locator('.board__cell[data-row="9"][data-col="5"]')
      .boundingBox();
    expect(bottomCell).not.toBeNull();
    if (bottomCell) {
      const requiredFingerY =
        bottomCell.y + bottomCell.height / 2 + TOUCH_LIFT_PX;
      expect(requiredFingerY).toBeLessThanOrEqual(c.h);
    }
  });
}

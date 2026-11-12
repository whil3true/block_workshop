import { test, expect } from '@playwright/test';

// Regression: in portrait the tray must span the board's width so its three
// slots stay wide and the pieces are evenly, generously spaced — and this must
// survive a landscape → portrait round-trip (it previously collapsed to the
// pieces' intrinsic width, leaving them jammed together).
test('portrait tray spans the board and survives a rotation round-trip', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/');
  await page.waitForSelector('#app[data-orientation="portrait"] .tray__slot');

  const measure = () =>
    page.evaluate(() => {
      const board = document.querySelector('.board') as HTMLElement;
      const tray = document.querySelector('.tray') as HTMLElement;
      const pieces = Array.from(
        document.querySelectorAll('.tray__piece'),
      ) as HTMLElement[];
      const b = board.getBoundingClientRect();
      const t = tray.getBoundingClientRect();
      const r = pieces.map((p) => p.getBoundingClientRect());
      const gaps: number[] = [];
      for (let i = 1; i < r.length; i++) gaps.push(r[i]!.left - r[i - 1]!.right);
      return { boardW: b.width, trayW: t.width, gaps };
    });

  const before = await measure();
  // Tray is the board's width (not collapsed to content).
  expect(Math.abs(before.trayW - before.boardW)).toBeLessThan(1.5);
  // Pieces are clearly separated.
  expect(before.gaps.length).toBe(2);
  for (const g of before.gaps) expect(g).toBeGreaterThan(12);

  // Landscape and back, via the real orientationchange event.
  await page.setViewportSize({ width: 852, height: 393 });
  await page.evaluate(() =>
    window.dispatchEvent(new Event('orientationchange')),
  );
  await page.waitForSelector('#app[data-orientation="landscape"]');
  await page.waitForTimeout(120);

  await page.setViewportSize({ width: 393, height: 852 });
  await page.evaluate(() =>
    window.dispatchEvent(new Event('orientationchange')),
  );
  await page.waitForSelector('#app[data-orientation="portrait"]');
  await page.waitForTimeout(120);

  const after = await measure();
  expect(Math.abs(after.trayW - after.boardW)).toBeLessThan(1.5);
  expect(Math.abs(after.trayW - before.trayW)).toBeLessThan(1.5);
  for (let i = 0; i < 2; i++) {
    expect(Math.abs(after.gaps[i]! - before.gaps[i]!)).toBeLessThan(1.5);
  }
});

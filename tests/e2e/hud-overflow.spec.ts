import { test, expect } from '@playwright/test';

// Regression: 4-digit (and beyond) SCORE/BEST values must not push the HUD
// past the safe content width and cause the page to scroll horizontally —
// which previously also drifted the board's on-screen position from the
// binder's computed value, breaking drop hit-tests.
test('iPhone portrait: 5-digit SCORE/BEST do not cause horizontal scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/');
  await page.waitForSelector('#app[data-orientation="portrait"]');

  // Force five-digit scores into both HUD pairs.
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll('.hud__score'))) {
      (el as HTMLElement).textContent = '99999';
    }
  });

  const m = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth - window.innerWidth,
    bodyScroll: document.body.scrollWidth - window.innerWidth,
    hud: document
      .querySelector<HTMLElement>('.hud')
      ?.getBoundingClientRect().width,
    board: document
      .querySelector<HTMLElement>('.board')
      ?.getBoundingClientRect().width,
  }));

  // No horizontal overflow at the page level (1px slack for sub-pixel rounding).
  expect(m.docScroll).toBeLessThanOrEqual(1);
  expect(m.bodyScroll).toBeLessThanOrEqual(1);
  // HUD width matches the board width (portrait pin).
  expect(m.hud).not.toBeUndefined();
  expect(m.board).not.toBeUndefined();
  if (m.hud != null && m.board != null) {
    expect(Math.abs(m.hud - m.board)).toBeLessThan(1.5);
  }
});

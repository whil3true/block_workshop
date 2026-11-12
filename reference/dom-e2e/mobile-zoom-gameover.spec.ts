import { test, expect } from '@playwright/test';

// Real touchscreen events in Chromium's mobile emulation, not desktop clicks.
// Double-tap must not change visual viewport scale or expose document scrolling.
test.use({ hasTouch: true, isMobile: true, viewport: { width: 393, height: 852 } });

test('double-tapping the HUD cannot zoom or scroll the game page', async ({ page }) => {
  await page.goto('/');
  await page.locator('.welcome [data-word="play"]').tap();
  const hud = page.locator('.hud__pair--current .hud__label');
  const rect = await hud.boundingBox();
  expect(rect).not.toBeNull();
  if (!rect) return;
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await page.touchscreen.tap(x, y);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(350);
  const result = await page.evaluate(() => ({
    scale: window.visualViewport?.scale ?? 1,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    touchAction: getComputedStyle(document.documentElement).touchAction,
  }));
  expect(result.touchAction).toBe('manipulation');
  expect(result.scale).toBeCloseTo(1, 2);
  expect(result.scrollX).toBe(0);
  expect(result.scrollY).toBe(0);
});

test('finished saved game is reset when Play is selected, without stale Game Over',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('block-workshop:lastGame',JSON.stringify({
      app:'block-workshop',schemaVersion:1,rulesVersion:1,
      state:{board:Array.from({length:10},()=>Array(10).fill('sq2')),
      trayIds:['single','single','single'],score:75,streak:0,rewardUsed:false},
    }));
  });
  await page.goto('/');
  await expect(page.locator('.overlay')).toHaveAttribute('data-visible','true');
  await expect(page.locator('.welcome [data-word="play"]')).toBeVisible();
  await page.locator('.welcome [data-word="play"]').tap();
  await expect(page.locator('.overlay')).toHaveAttribute('data-visible','false');
  await expect(page.locator('.hud__pair--current .hud__score')).toHaveText('0');
  await page.locator('.appbar [data-word="menu"]').tap();
  await expect(page.locator('.welcome')).toBeVisible();
  await page.locator('.welcome [data-word="play"]').tap();
  await expect(page.locator('.overlay')).toHaveAttribute('data-visible','false');
  await expect(page.locator('.board__cell[data-state="filled"]')).toHaveCount(0);
});

import { test, expect } from './fixtures';
import { sdk } from './sdk-fixture';
import { click, drag, frames, snapshot } from './helpers';

test.use({ viewport: { width: 393, height: 852 } });
for (const kind of ['close-first', 'resume-first', 'no-fill', 'error', 'background'] as const) {
 test(`Classic placement ad ${kind}: one saved drop, no double request, independent pause release`, async ({ page }) => {
  await sdk(page, false, kind === 'resume-first' ? 'en' : 'ru');
  await click(page, 240, 580);
  await page.evaluate(() => { window.qaSdk.offset += 90_001; window.qaSdk.activeOffset += 90_001; });
  await frames(page);
  expect(await page.evaluate(() => window.qaSdk.requests)).toBe(0);
  await drag(page, 0, 0, 0);
  await expect.poll(() => page.evaluate(() => window.qaSdk.requests)).toBe(1);
  const saved = await snapshot(page);
  expect(saved.score).toBe(1);
  await drag(page, 1, 0, 1);
  expect(await snapshot(page)).toEqual(saved);
  if (kind !== 'no-fill' && kind !== 'error') {
   await page.evaluate(() => {
    window.qaSdk.fullscreen?.onOpen?.(); window.qaSdk.fullscreen?.onOpen?.();
    window.qaSdk.emit('game_api_pause');
   });
  }
  if (kind === 'background') await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  if (kind === 'resume-first') {
   await page.evaluate(() => window.qaSdk.emit('game_api_resume')); await frames(page, 5);
   await drag(page, 1, 0, 1); expect(await snapshot(page)).toEqual(saved);
  }
  await page.evaluate(kind => {
   if (kind === 'error') window.qaSdk.fullscreen?.onError?.({});
   else window.qaSdk.fullscreen?.onClose?.(kind !== 'no-fill');
  }, kind);
  await frames(page, 5);
  if (kind === 'close-first' || kind === 'background') {
   await drag(page, 1, 0, 1); expect(await snapshot(page)).toEqual(saved);
   await page.evaluate(() => window.qaSdk.emit('game_api_resume')); await frames(page, 5);
  }
  if (kind === 'background') {
   await drag(page, 1, 0, 1); expect(await snapshot(page)).toEqual(saved);
   await page.evaluate(() => window.dispatchEvent(new Event('pageshow'))); await frames(page, 5);
  }
  await page.evaluate(() => {
   window.qaSdk.fullscreen?.onClose?.(true); window.qaSdk.fullscreen?.onError?.({});
   window.qaSdk.fullscreen?.onOpen?.();
  });
  await frames(page, 5);
  expect(await snapshot(page)).toEqual(saved);
  await drag(page, 1, 0, 1);
  expect((await snapshot(page)).score).toBe(2);
  expect(await page.evaluate(() => window.qaSdk.requests)).toBe(1);
  await page.reload(); await expect(page.locator('canvas')).toHaveAttribute('aria-busy', 'false');
  expect((await snapshot(page)).score).toBe(2);
 });
}

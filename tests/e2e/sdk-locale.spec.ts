import { test, expect } from './fixtures';
import { sdk } from './sdk-fixture';
import { click, drag, frames, snapshot } from './helpers';
import { UI_LOCALE_STORAGE_KEY } from '../../src/platform/WebLocaleStore';
import { CAMPAIGN_KEY } from '../../src/campaign/CampaignStore';
import { CAMPAIGN_CATALOG } from '../../src/campaign/CampaignCatalog';
import { AUDIO_SETTINGS_STORAGE_KEY } from '../../src/platform/WebAudioSettingsStore';

test.use({ viewport: { width: 393, height: 852 } });
async function changeSdkAndReload(page: import('@playwright/test').Page, language: string) {
 await page.evaluate(language => sessionStorage.setItem('qa-sdk-language', language), language);
 await page.reload();
 await expect(page.locator('canvas')).toHaveAttribute('aria-busy', 'false');
 await frames(page, 5);
}
async function preference(page: import('@playwright/test').Page) {
 return page.evaluate(key => localStorage.getItem(key), UI_LOCALE_STORAGE_KEY);
}
async function trackWrites(page: import('@playwright/test').Page) {
 await page.addInitScript(key => {
  const original = Storage.prototype.setItem;
  const writes: string[] = [];
  Object.assign(window, { qaLocaleWrites: writes });
  Storage.prototype.setItem = function(name, value) {
   if (this === localStorage && name === key) writes.push(value);
   return original.call(this, name, value);
  };
 }, UI_LOCALE_STORAGE_KEY);
}
async function writes(page: import('@playwright/test').Page) {
 return page.evaluate(() => (window as unknown as { qaLocaleWrites: string[] }).qaLocaleWrites);
}

for (const initial of ['ru', 'en']) {
 const other = initial === 'ru' ? 'en' : 'ru';
 test(`SDK ${initial} → ${other}: no automatic preference; only a changed settings button persists`, async ({ page }) => {
  await trackWrites(page);
  await sdk(page, false, initial);
  await expect(page.locator('html')).toHaveAttribute('lang', initial);
  expect(await preference(page)).toBeNull();
  expect(await writes(page)).toEqual([]);
  await changeSdkAndReload(page, other);
  await expect(page.locator('html')).toHaveAttribute('lang', other);
  expect(await preference(page)).toBeNull();
  expect(await writes(page)).toEqual([]);
  await click(page, 240, 690);
  await click(page, other === 'ru' ? 150 : 330, 230);
  expect(await writes(page)).toEqual([]);
  await click(page, initial === 'ru' ? 150 : 330, 230);
  await expect(page.locator('html')).toHaveAttribute('lang', initial);
  expect(await preference(page)).toBe(initial);
  expect(await writes(page)).toEqual([initial]);
  await click(page, initial === 'ru' ? 150 : 330, 230);
  expect(await writes(page)).toEqual([initial]);
  await changeSdkAndReload(page, other);
  await expect(page.locator('html')).toHaveAttribute('lang', initial);
  expect(await writes(page)).toEqual([]);
  await click(page, 240, 580); await drag(page, 0, 0, 0);
  const saved = await snapshot(page);
  expect(saved.score).toBe(1);
  await changeSdkAndReload(page, other);
  expect(await snapshot(page)).toEqual(saved);
  await expect(page.locator('html')).toHaveAttribute('lang', initial);
 });
 test(`legacy ${initial} overrides SDK ${other}; locale-only reset preserves progress and audio`, async ({ page }) => {
  await page.addInitScript(({ localeKey, initial, campaignKey, orderId, audioKey }) => {
   if (sessionStorage.getItem('qa-legacy-locale')) return;
   sessionStorage.setItem('qa-legacy-locale', 'true');
   localStorage.setItem(localeKey, initial);
   localStorage.setItem(campaignKey, JSON.stringify({ app: 'block-workshop', mode: 'campaign', schemaVersion: 2,
    catalogVersion: 2, targetRulesVersion: 2, completedOrderIds: [orderId], active: null, notice: null }));
   localStorage.setItem(audioKey, JSON.stringify({ version: 1, musicVolume: .2, sfxVolume: .8 }));
  }, { localeKey: UI_LOCALE_STORAGE_KEY, initial, campaignKey: CAMPAIGN_KEY,
   orderId: CAMPAIGN_CATALOG[0]!.id, audioKey: AUDIO_SETTINGS_STORAGE_KEY });
  await sdk(page, false, other);
  await expect(page.locator('html')).toHaveAttribute('lang', initial);
  await click(page, 240, 580); await drag(page, 0, 0, 0);
  const before = await page.evaluate(() => ({ ...localStorage }));
  await page.evaluate(key => localStorage.removeItem(key), UI_LOCALE_STORAGE_KEY);
  await page.reload(); await expect(page.locator('canvas')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('html')).toHaveAttribute('lang', other);
  const expected = { ...before }; delete expected[UI_LOCALE_STORAGE_KEY];
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(expected);
  await click(page, 240, 580); await drag(page, 1, 0, 1);
  expect((await snapshot(page)).score).toBe(2);
 });
}
test('unsupported SDK language falls back to English without creating a preference', async ({ page }) => {
 await sdk(page, false, 'de');
 await expect(page.locator('html')).toHaveAttribute('lang', 'en');
 expect(await preference(page)).toBeNull();
});

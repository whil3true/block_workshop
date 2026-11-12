import { test, expect } from '@playwright/test';

test('runtime language changes do not remove browser translation opt-out', async ({ page }) => {
  await page.goto('/');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('translate', 'no');
  await expect(root).toHaveClass(/notranslate/);
  await expect(page.locator('meta[name="google"]')).toHaveAttribute('content', 'notranslate');
  await expect(page.locator('#app')).toHaveAttribute('translate', 'no');
  await page.locator('.welcome [data-word="settings"]').click();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(root).toHaveAttribute('lang', 'en');
  await expect(root).toHaveAttribute('translate', 'no');
  await page.getByRole('button', { name: 'RU', exact: true }).click();
  await expect(root).toHaveAttribute('lang', 'ru');
  await expect(root).toHaveAttribute('translate', 'no');
});

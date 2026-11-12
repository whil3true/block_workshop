import { test as base, expect } from '@playwright/test';
/** Every production browser scenario must finish without uncaught runtime errors. */
export const test = base.extend<{ runtimeErrors: void }>({
 runtimeErrors: [async ({ page }, use) => {
  const errors: string[] = [];
  const listener = (error: Error): void => { errors.push(error.message); };
  page.on('pageerror', listener);
  await use();
  page.off('pageerror', listener);
  expect(errors, 'Uncaught production browser errors').toEqual([]);
 }, { auto: true }],
});
export { expect };

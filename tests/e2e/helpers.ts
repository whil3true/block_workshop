import { expect, type Page } from '@playwright/test';
export async function seed(page: Page, options: { board?: (string | null)[][]; tray?: (string|null)[]; score?: number; streak?: number; rewardUsed?: boolean; locale?: string } = {}) {
 await page.addInitScript(options => {
  if (sessionStorage.getItem('qa-seeded')) return;
  sessionStorage.setItem('qa-seeded', 'true');
  if (options.locale !== undefined) localStorage.setItem('block-workshop:ui-locale', options.locale);
  localStorage.setItem('block-workshop:lastGame', JSON.stringify({ app: 'block-workshop', schemaVersion: 1, rulesVersion: 1, state: {
   board: options.board ?? Array.from({length: 10}, () => Array(10).fill(null)), trayIds: options.tray ?? ['single','single','single'],
   score: options.score ?? 0, streak: options.streak ?? 0, rewardUsed: options.rewardUsed ?? false,
  }}));
 }, options);
}
export async function snapshot(page: Page) {
 return page.evaluate(() => JSON.parse(localStorage.getItem('block-workshop:lastGame')!).state as {board: (string|null)[][];trayIds: (string|null)[]; score:number;streak:number;rewardUsed:boolean});
}
export async function point(page: Page, x: number, y: number) {
 const box = await page.locator('canvas').boundingBox(); if (!box) throw Error('Canvas is missing');
 const scale = box.width / 480;
 return { x: box.x + x * scale, y: box.y + box.height / 2 + (y - 400) * scale };
}
export async function click(page: Page, x: number, y: number) {
 const p = await point(page,x,y); await page.mouse.click(p.x,p.y); await frames(page);
}
export async function frames(page: Page) {
 await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}
export async function open(page: Page, url = '/', waitForReady = true) {
 await page.goto(url); await expect(page.locator('canvas')).toBeVisible();
 if(waitForReady) await expect(page.locator('canvas')).toHaveAttribute('aria-busy','false');
 // Initial scene render + ready menu render, without a production debug hook.
 await frames(page); await frames(page);
}
export async function drag(page: Page, slot: number, row: number, col: number) {
 const from = await point(page, [90,240,390][slot]!,670);
 const to = await point(page,20+(col+0.5)*44,156+(row+0.5)*44);
 await page.mouse.move(from.x,from.y); await page.mouse.down();
 await page.mouse.move(to.x,to.y,{steps:8}); await page.mouse.up();
 await frames(page);
}

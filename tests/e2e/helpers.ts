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
 const insets = await page.evaluate(() => {
  const style = getComputedStyle(document.body);
  const edge = (name: string): number => parseFloat(style.getPropertyValue(`--safe-${name}`)) || 0;
  return {left:edge('left'),right:edge('right'),top:edge('top'),bottom:edge('bottom')};
 });
 const scale = Math.min((box.width-insets.left-insets.right)/480,(box.height-insets.top-insets.bottom)/800);
 return { x: box.x + (box.width+insets.left-insets.right)/2 + (x-240)*scale,
  y: box.y + (box.height+insets.top-insets.bottom)/2 + (y-400)*scale };
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
 // Keep a real multi-event drag, but avoid eight costly software-GL frames
 // per placement on headless CI. Native touch events are tested separately.
 await page.mouse.move(to.x,to.y,{steps:3}); await page.mouse.up();
 await frames(page);
}

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
/** Read one current geometry snapshot for all points in an input gesture. No cross-resize cache. */
async function points(page: Page, coordinates: readonly {x:number;y:number}[]) {
 return page.locator('canvas').evaluate((canvas,coordinates) => {
  const box=canvas.getBoundingClientRect(),style=getComputedStyle(document.body);
  const edge=(name:string):number=>parseFloat(style.getPropertyValue(`--safe-${name}`))||0;
  const left=edge('left'),right=edge('right'),top=edge('top'),bottom=edge('bottom');
  const scale=Math.min((box.width-left-right)/480,(box.height-top-bottom)/800);
  return coordinates.map(({x,y})=>({x:box.x+(box.width+left-right)/2+(x-240)*scale,
   y:box.y+(box.height+top-bottom)/2+(y-400)*scale}));
 },coordinates);
}
export async function point(page: Page, x: number, y: number) {
 return (await points(page,[{x,y}]))[0]!;
}
export async function click(page: Page, x: number, y: number) {
 const p = await point(page,x,y); await page.mouse.click(p.x,p.y); await frames(page,3);
}
export async function frames(page: Page, count = 2) {
 // AdFlow releases its gate after two RAFs; a clicked destination needs the
 // following Phaser render to rebuild enabled hit areas before the next input.
 await page.evaluate(count => new Promise<void>(resolve => {
  const tick = (): void => { if (--count <= 0) resolve(); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
 }),count);
}
export async function open(page: Page, url = '/', waitForReady = true) {
 await page.goto(url); await expect(page.locator('canvas')).toBeVisible();
 if(waitForReady) await expect(page.locator('canvas')).toHaveAttribute('aria-busy','false');
 // Initial scene render + ready menu render, without a production debug hook.
 await frames(page); await frames(page);
}
export async function drag(page: Page, slot: number, row: number, col: number) {
 const [from,to] = await points(page,[{x:[90,240,390][slot]!,y:670},{x:20+(col+0.5)*44,y:156+(row+0.5)*44}]) as [{x:number;y:number},{x:number;y:number}];
 await page.mouse.move(from.x,from.y); await page.mouse.down();
 // Keep a real multi-event drag, but avoid eight costly software-GL frames
 // per placement on headless CI. Native touch events are tested separately.
 await page.mouse.move(to.x,to.y,{steps:3}); await page.mouse.up();
 await frames(page);
}

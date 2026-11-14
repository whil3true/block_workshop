import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { click, frames, open, point, seed, snapshot } from './helpers';

async function region(page: Page, x: number, y: number, width: number, height: number) {
 const a=await point(page,x,y),b=await point(page,x+width,y+height);
 return page.screenshot({clip:{x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y}});
}
async function hold(page: Page, slot: number) {
 const p=await point(page,[90,240,390][slot]!,670);
 await page.mouse.move(p.x,p.y);await page.mouse.down();await frames(page);
}
async function move(page: Page,x: number,y: number) {
 const p=await point(page,x,y);await page.mouse.move(p.x,p.y,{steps:3});await frames(page);
}

// Run unchanged against dev before the UX changes: these use actual Canvas input,
// rendered pixels and persisted state, without a production scene/debug API.
for(const viewport of [{width:1920,height:1080},{width:852,height:393}]) {
 test(`full Canvas side gutters preserve held drag at ${viewport.width}x${viewport.height}`,async({page},info)=>{
  await page.setViewportSize(viewport);await seed(page,{locale:'en'});await open(page);await click(page,240,565);
  const saved=await snapshot(page),board=await region(page,20,156,440,440);
  const side=await region(page,-170,350,70,70),otherSide=await region(page,580,350,70,70);
  await hold(page,0);await move(page,42,178);
  expect((await region(page,20,156,440,440)).equals(board),'Preview appears on board').toBe(false);
  await move(page,-135,385);
  expect((await region(page,20,156,440,440)).equals(board),'Preview clears outside board').toBe(true);
  expect((await region(page,-170,350,70,70)).equals(side),'Held figure follows into left gutter').toBe(false);
  expect(await snapshot(page)).toEqual(saved);
  await page.screenshot({path:info.outputPath('held-in-left-gutter.png')});
  await move(page,615,385);
  expect((await region(page,-170,350,70,70)).equals(side),'Ghost leaves previous gutter').toBe(true);
  expect((await region(page,580,350,70,70)).equals(otherSide),'Held figure follows into right gutter').toBe(false);
  await page.mouse.up();await frames(page);expect(await snapshot(page)).toEqual(saved);
  await hold(page,0);await move(page,615,385);await move(page,42,178);
  expect((await region(page,20,156,440,440)).equals(board),'Preview returns on re-entry').toBe(false);
  await page.mouse.up();await frames(page);expect((await snapshot(page)).score).toBe(1);
  expect((await snapshot(page)).trayIds[0]).toBeNull();
 });
}

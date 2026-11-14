import { test, expect } from './fixtures';
import { click, drag, frames, open, seed, snapshot } from './helpers';
import type { Page } from '@playwright/test';

// Decode the browser screenshot in an offscreen 2D canvas. This measures the
// final CSS-paper + transparent Canvas composite, not a mocked renderer.
async function pixels(page:Page, png:Buffer, points:{x:number;y:number}[]) {
 return page.evaluate(async({base64,points})=>{
  const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
  return points.map(p=>Array.from(ctx.getImageData(Math.round(p.x),Math.round(p.y),1,1).data).slice(0,3));
 },{base64:png.toString('base64'),points});
}
for(const viewport of [{width:320,height:568},{width:360,height:640},{width:852,height:393},{width:1280,height:800}]) {
 for(const locale of ['ru','en'])test(`one viewport dim and interactive settings ${viewport.width}x${viewport.height} ${locale}`,async({page},info)=>{
  await page.setViewportSize(viewport);await seed(page,{locale});await open(page);await click(page,240,580);
  await expect(page.locator('canvas')).toHaveCount(1);
  const box=await page.locator('canvas').boundingBox();expect(box).toMatchObject({x:0,y:0,...viewport});
  const points=[{x:3,y:3},{x:viewport.width/2,y:3},{x:viewport.width-4,y:3}];
  const before=await page.screenshot({path:info.outputPath('game-before.png')});
  const original=await pixels(page,before,points);const saved=await snapshot(page);
  await click(page,431,45);
  const dim=await page.screenshot({path:info.outputPath('settings-open.png')});
  const dimmed=await pixels(page,dim,points);
  for(let i=0;i<points.length;i++)for(let c=0;c<3;c++) {
   // One 48% brown source must have the same transfer function centrally
   // and at BOTH viewport edges, with 2 RGB levels of raster rounding tolerance.
   expect(Math.abs(dimmed[i]![c]!-(original[i]![c]!*.52+[78,64,56][c]!*.48))).toBeLessThanOrEqual(2);
  }
  await drag(page,0,0,0);expect(await snapshot(page)).toEqual(saved);
  await click(page,locale==='ru'?330:150,230);
  await expect(page.locator('html')).toHaveAttribute('lang',locale==='ru'?'en':'ru');
  await click(page,80,338);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('block-workshop:audio-settings')!).musicVolume)).toBe(0);
  await click(page,240,667);
  const restored=await page.screenshot({path:info.outputPath('game-restored.png')});
  expect(await pixels(page,restored,points)).toEqual(original);
  await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(1);
 });
}
test('external pause over settings has one dim and restores the modal input owner',async({page},info)=>{
 await seed(page,{locale:'en'});await page.setViewportSize({width:852,height:393});await open(page);await click(page,240,580);await click(page,431,45);
 const points=[{x:5,y:3},{x:426,y:3},{x:846,y:3}];const before=await pixels(page,await page.screenshot(),points);
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await frames(page);
 const paused=await page.screenshot({path:info.outputPath('external-pause.png')});expect(await pixels(page,paused,points)).toEqual(before);
 await click(page,150,230);await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await frames(page);await click(page,150,230);
 await expect(page.locator('html')).toHaveAttribute('lang','ru');await click(page,240,667);await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(1);
});
test('order journal removes its settings hit area and retains Back navigation',async({page},info)=>{
 await seed(page,{locale:'en'});await open(page);await click(page,240,412);await click(page,431,45);
 await page.screenshot({path:info.outputPath('journal-no-settings.png')});
 await click(page,240,278);await click(page,431,45);await click(page,150,230);
 await expect(page.locator('html')).toHaveAttribute('lang','ru');await click(page,240,667);
 await click(page,49,45);await click(page,49,45);await click(page,240,580);await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(1);
});

import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { click, frames, open, point, seed, snapshot } from './helpers';
import { CAMPAIGN_KEY } from '../../src/campaign/CampaignStore';
import type { CampaignAttempt } from '../../src/campaign/CampaignSession';

async function region(page: Page, x: number, y: number, width: number, height: number) {
 const a=await point(page,x,y),b=await point(page,x+width,y+height);
 return page.screenshot({clip:{x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y}});
}

async function saves(page: Page) {
 return page.evaluate(key=>({classic:localStorage.getItem('block-workshop:lastGame'),campaign:localStorage.getItem(key)}),CAMPAIGN_KEY);
}
async function attempt(page: Page) {
 return page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).active as CampaignAttempt,CAMPAIGN_KEY);
}
async function start(page: Page,mode: 'classic'|'campaign') {
 await seed(page,{locale:'en',board:Array.from({length:10},(_,r)=>Array.from({length:10},(_,c)=>r===8&&c===0?'single':null))});
 await open(page);await click(page,240,mode==='classic'?565:412);
 if(mode==='campaign')await click(page,240,278);
}

for(const mode of ['classic','campaign'] as const) {
 test(`${mode}: all three source figures hide, reject, restore, place and refill`,async({page},info)=>{
  await page.setViewportSize({width:393,height:852});await start(page,mode);
  for(const slot of [0,1,2]) {
   const source=await region(page,[30,180,330][slot]!,626,120,104),saved=await saves(page);
   await hold(page,slot);await move(page,42,530); // Occupied (8,0) in both modes.
   const hidden=await region(page,[30,180,330][slot]!,626,120,104);
   expect(hidden.equals(source),'Only source figure disappears while held').toBe(false);
   expect(await saves(page)).toEqual(saved);
   if(slot===0)await page.screenshot({path:info.outputPath(`${mode}-invalid-no-hatching.png`)});
   await page.mouse.up();await frames(page);
   expect(await saves(page)).toEqual(saved);
   expect((await region(page,[30,180,330][slot]!,626,120,104)).equals(source),'Invalid drop restores source').toBe(true);
   await hold(page,slot);await move(page,42+slot*132,178);
   if(slot===0)await page.screenshot({path:info.outputPath(`${mode}-valid-source-hidden.png`)});
   await page.mouse.up();await frames(page);
   if(slot<2)expect((await region(page,[30,180,330][slot]!,626,120,104)).equals(hidden),'Successful drop leaves source slot empty').toBe(true);
   if(mode==='classic')expect((await snapshot(page)).score).toBe(slot+1);
   else expect((await attempt(page)).moves).toBe(slot+1);
  }
  const tray=mode==='classic'?(await snapshot(page)).trayIds:(await attempt(page)).trayIds;
  expect(tray.every(Boolean),'Three consumed figures produce next set').toBe(true);
 });

 test(`${mode}: interruptions restore source without changing either save`,async({page})=>{
  await page.setViewportSize({width:393,height:852});await start(page,mode);
  const source=await region(page,30,626,120,104),header=await region(page,0,0,480,70),saved=await saves(page);
  for(const reason of ['pointercancel','blur','pagehide','resize','modal','escape']) {
   await hold(page,0);await move(page,240,310);
   expect((await region(page,30,626,120,104)).equals(source)).toBe(false);
   if(reason==='pointercancel')await page.locator('canvas').dispatchEvent('pointercancel',{pointerId:1});
   if(reason==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
   if(reason==='pagehide')await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
   if(reason==='resize')await page.setViewportSize({width:852,height:393});
   // A second mouse down exercises the actual modal hit zone while holding.
   if(reason==='modal') {
    await click(page,431,45);
    expect((await region(page,0,0,480,70)).equals(header),'Settings actually opened above the held drag').toBe(false);
   }
   if(reason==='escape')await page.keyboard.press('Escape');
   await frames(page);await move(page,42,178);await page.mouse.up();await frames(page);
   expect(await saves(page),`${reason} must never commit a placement`).toEqual(saved);
   if(reason==='pagehide')await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
   if(reason==='resize')await page.setViewportSize({width:393,height:852});
   if(reason==='modal')await click(page,240,667);
   if(reason==='escape') {
    await click(page,240,mode==='classic'?565:412);
    if(mode==='campaign')await click(page,240,278);
   }
   expect(await saves(page),`${reason} preserves saves after returning to play`).toEqual(saved);
   await frames(page);await frames(page);
   expect((await region(page,30,626,120,104)).equals(source),`${reason} restores source`).toBe(true);
  }
 });
}

test('Chromium native Android touch: lift, both gutters, touchcancel and orientation',async({page,browserName},info)=>{
 test.skip(browserName!=='chromium','Native touch injection uses Chromium CDP');
 const client=await page.context().newCDPSession(page);
 await client.send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36',platform:'Linux armv8l'});
 await client.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await page.setViewportSize({width:393,height:852});await start(page,'classic');
 const send=async(type:'touchStart'|'touchMove'|'touchEnd'|'touchCancel',x=0,y=0)=>{
  const p=await point(page,x,y);
  await client.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{...p,id:1}]});await frames(page);
 };
 const saved=await saves(page),source=await region(page,30,626,120,104);
 await send('touchStart',90,670);await send('touchMove',42,218);
 expect((await region(page,30,626,120,104)).equals(source)).toBe(false);
 await page.screenshot({path:info.outputPath('android-touch-lift.png')});
 await send('touchCancel');expect(await saves(page)).toEqual(saved);
 expect((await region(page,30,626,120,104)).equals(source)).toBe(true);
 await send('touchStart',90,670);await send('touchMove',42,218);
 await page.setViewportSize({width:852,height:393});await frames(page);await send('touchEnd');
 expect(await saves(page)).toEqual(saved);
 const side=await region(page,580,350,70,70);
 await send('touchStart',90,670);await send('touchMove',-135,425);await send('touchMove',615,425);
 expect((await region(page,580,350,70,70)).equals(side),'Touch-held figure follows into landscape gutter').toBe(false);
 await page.screenshot({path:info.outputPath('android-landscape-gutter.png')});
 await send('touchEnd');expect(await saves(page)).toEqual(saved);
 await send('touchStart',90,670);await send('touchMove',615,425);await send('touchMove',42,218);await send('touchEnd');
 expect((await snapshot(page)).score).toBe(1);expect((await snapshot(page)).board[0]![0]).toBe('single');
});
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

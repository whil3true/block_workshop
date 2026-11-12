import { test, expect } from '@playwright/test';
import { seed, snapshot, point, click, frames, open, drag } from './helpers';
test.use({ viewport: { width:393, height:852 } });
test('Canvas placement, continued board, live RU/EN, volume settings and confirmed restart', async ({page}, info) => {
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await seed(page,{locale:'en'});await open(page);
 await expect(page.locator('button,input,.board,.tray')).toHaveCount(0);
 await click(page,240,510);await drag(page,0,0,0);
 await expect.poll(async()=>(await snapshot(page)).score).toBe(1);
 await page.screenshot({path:info.outputPath('mobile-gameplay.png')});
 await click(page,363,76);await click(page,240,510);expect((await snapshot(page)).score).toBe(1);
 await page.reload();await frames(page);await frames(page);await click(page,240,510);expect((await snapshot(page)).board[0]![0]).toBe('single');
 await click(page,117,76);await click(page,150,230);await expect(page.locator('html')).toHaveAttribute('lang','ru');
 await click(page,80,338);await click(page,400,438);
 const settings=await page.evaluate(()=>localStorage.getItem('block-workshop:audio-settings'));
 expect(JSON.parse(settings!)).toMatchObject({musicVolume:0,sfxVolume:1});
 await page.screenshot({path:info.outputPath('mobile-settings-ru.png')});
 await click(page,240,667);await drag(page,1,9,9);expect((await snapshot(page)).score).toBe(2);
 await click(page,130,759);await click(page,240,518);expect((await snapshot(page)).score).toBe(2);
 await click(page,130,759);await click(page,240,450);
 await expect.poll(async()=>(await snapshot(page)).score).toBe(0);
 await page.reload();await frames(page);await frames(page);await expect(page.locator('html')).toHaveAttribute('lang','ru');
 expect(errors).toEqual([]);
});
test('settings from menu, invalid edge drop, empty slots and fresh three-piece refill',async({page})=>{
 await seed(page,{locale:'ru'});await open(page);await click(page,240,578);await click(page,330,230);
 await expect(page.locator('html')).toHaveAttribute('lang','en');await click(page,240,667);await click(page,240,510);
 await drag(page,0,0,0);await drag(page,0,1,0);expect((await snapshot(page)).score).toBe(1);
 await drag(page,1,0,0);expect((await snapshot(page)).score).toBe(1);
 await drag(page,1,9,9);await drag(page,2,0,9);expect((await snapshot(page)).score).toBe(3);
 expect((await snapshot(page)).trayIds.every(Boolean)).toBe(true);
});
test('first and last cells, non-single bounds, row+column simultaneous clear and perfect bonus',async({page})=>{
 const board:(string|null)[][]=Array.from({length:10},()=>Array(10).fill(null));
 for(let i=0;i<10;i++){board[9]![i]='single';board[i]![9]='single';}board[9]![9]=null;
 await seed(page,{board,tray:['single','penta-h','square-3'],locale:'en'});await open(page);await click(page,240,510);
 await drag(page,1,0,9);expect((await snapshot(page)).score).toBe(0);
 await drag(page,0,9,9);expect((await snapshot(page)).score).toBe(331);
 expect((await snapshot(page)).board.flat().every(c=>c===null)).toBe(true);
 await drag(page,1,9,5);expect((await snapshot(page)).score).toBe(336);
});
test('game over, menu and Play start a new session without restoring defeat',async({page},info)=>{
 const board:(string|null)[][]=Array.from({length:10},()=>Array(10).fill('sq2'));board[0]![0]=null;board[1]![1]=null;
 await seed(page,{board,tray:['single','square-3','square-3'],locale:'en',score:75});await open(page);await click(page,240,510);
 await drag(page,0,0,0);expect((await snapshot(page)).score).toBeGreaterThan(75);
 await page.screenshot({path:info.outputPath('game-over.png')});
 await click(page,240,534);await click(page,240,510);
 await expect.poll(async()=>(await snapshot(page)).score).toBe(0);expect((await snapshot(page)).board.flat().every(c=>c===null)).toBe(true);
 await drag(page,0,0,0);expect((await snapshot(page)).score).toBeGreaterThan(0);
});
test('already finished saved session starts a playable fresh board',async({page})=>{
 await seed(page,{board:Array.from({length:10},()=>Array(10).fill('sq2')),score:75});await open(page);await click(page,240,510);
 await expect.poll(async()=>(await snapshot(page)).score).toBe(0);
});
for (const viewport of [{width:320,height:568},{width:360,height:640},{width:393,height:852},{width:768,height:1024},{width:1920,height:1080},{width:852,height:393}]) {
 test(`no scroll, visible field and resize at ${viewport.width}x${viewport.height}`,async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await seed(page);await page.setViewportSize(viewport);await open(page);await click(page,240,510);await drag(page,0,9,9);
  expect((await snapshot(page)).score).toBe(1);
  const metrics=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,x:scrollX,y:scrollY}));
  expect(metrics.sw).toBeLessThanOrEqual(metrics.w);expect(metrics.sh).toBeLessThanOrEqual(metrics.h);expect(metrics.x).toBe(0);expect(metrics.y).toBe(0);
  await page.screenshot({path:info.outputPath('viewport.png')});
  await page.setViewportSize({width:viewport.height,height:viewport.width});await frames(page);await frames(page);await drag(page,1,0,0);
  expect((await snapshot(page)).score).toBe(2);expect(errors).toEqual([]);
 });
}
test('touch drag, double-tap zoom protection and browser pause cancel',async({page,browserName})=>{
 test.skip(browserName!=='chromium','Uses Chromium native touch events via CDP');
 const client=await page.context().newCDPSession(page);await client.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await seed(page);await open(page);await click(page,240,510);
 const from=await point(page,90,670),to=await point(page,42,178+40);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:to.x,y:to.y}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frames(page);
 expect((await snapshot(page)).score).toBe(1);
 const hud=await point(page,130,127);
 for(let i=0;i<2;i++) {await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[hud]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 expect(await page.evaluate(()=>visualViewport?.scale)).toBeCloseTo(1);
 const start=await point(page,240,670);await page.mouse.move(start.x,start.y);await page.mouse.down();
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await frames(page);
 const target=await point(page,438,574);await page.mouse.move(target.x,target.y);await page.mouse.up();expect((await snapshot(page)).score).toBe(1);
 await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await frames(page);await drag(page,1,9,9);expect((await snapshot(page)).score).toBe(2);
});
test('large saved score fits a compact mobile HUD without changing progress',async({page},info)=>{
 await seed(page,{locale:'ru',score:123456789012345,streak:2,rewardUsed:true});await page.setViewportSize({width:320,height:568});
 await open(page);await click(page,240,510);await page.screenshot({path:info.outputPath('large-score-hud.png')});
 expect((await snapshot(page)).score).toBe(123456789012345);
 await click(page,117,76);await click(page,330,230);await click(page,240,667);await drag(page,0,0,0);
 expect((await snapshot(page)).score).toBe(123456789012346);
});

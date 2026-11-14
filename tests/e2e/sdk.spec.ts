import { type Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { seed, snapshot, point, click, open, drag, frames } from './helpers';
import type { YandexSdk } from '../../src/platform/YandexSdkTypes';
declare global { interface Window { qaSdk: {
 ready:number; starts:number; stops:number; requests:number; rewardRequests:number; offset:number;
 emit:(event:string)=>void; fullscreen:NonNullable<Parameters<NonNullable<YandexSdk['adv']>['showFullscreenAdv']>[0]>['callbacks'];
 reward:Parameters<NonNullable<YandexSdk['adv']>['showRewardedVideo']>[0]['callbacks'];
} } }
async function sdk(page: Page, startupPause = false) {
 await page.route('http://sdk.block.test/**', async route => {
  const url = new URL(route.request().url());
  const response = await route.fetch({url:'http://127.0.0.1:4180'+url.pathname, headers:{...route.request().headers(),host:'127.0.0.1:4180'}});
  await route.fulfill({response});
 });
 await page.addInitScript(startupPause => {
  const listeners = new Map<string,Set<()=>void>>();
  const qa: Window['qaSdk'] = window.qaSdk = { ready:0,starts:0,stops:0,requests:0,rewardRequests:0,offset:0,
   fullscreen:undefined, reward:{}, emit:(event:string)=>listeners.get(event)?.forEach(f=>f()) };
  const now=Date.now;Date.now=()=>now()+qa.offset;
  const sdk = {
   environment:{i18n:{lang:'ru'}}, features:{LoadingAPI:{ready:()=>qa.ready++},GameplayAPI:{start:()=>qa.starts++,stop:()=>qa.stops++}},
   on:(event:string,handler:()=>void)=>{if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event)!.add(handler);if(startupPause&&event==='game_api_pause')handler();},
   off:(event:string,handler:()=>void)=>listeners.get(event)?.delete(handler),
   adv:{showFullscreenAdv:({callbacks}: {callbacks:Window['qaSdk']['fullscreen']})=>{qa.requests++;qa.fullscreen=callbacks;},
    showRewardedVideo:({callbacks}: {callbacks:Window['qaSdk']['reward']})=>{qa.rewardRequests++;qa.reward=callbacks;}},
  };
  Object.assign(window,{YaGames:{init:async()=>sdk}});
 },startupPause);
 await seed(page);await open(page,'http://sdk.block.test/',!startupPause);
}
test.use({viewport:{width:393,height:852}});
test('startup SDK pause holds input and LoadingAPI.ready; gameplay obeys independent pause owners',async({page})=>{
 await sdk(page,true);await click(page,240,565);expect(await page.evaluate(()=>window.qaSdk.ready)).toBe(0);
 await page.evaluate(()=>window.qaSdk.emit('game_api_resume'));await frames(page);await frames(page);
 await expect.poll(()=>page.evaluate(()=>window.qaSdk.ready)).toBe(1);
 await expect(page.locator('html')).toHaveAttribute('lang','ru');
 await click(page,240,565);expect(await page.evaluate(()=>window.qaSdk.starts)).toBe(1);
 await page.evaluate(()=>{window.qaSdk.emit('game_api_pause');window.dispatchEvent(new Event('pagehide'));});await frames(page);
 await page.evaluate(()=>window.qaSdk.emit('game_api_resume'));await frames(page);await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(0);
 await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await frames(page);await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(1);
 expect(await page.evaluate(()=>window.qaSdk.ready)).toBe(1);
});
for(const mode of ['classic','campaign']) {
 test(`${mode}: SDK interruption restores a held source figure and preserves saves`,async({page})=>{
  await sdk(page);await click(page,240,mode==='classic'?565:412);if(mode==='campaign')await click(page,240,278);
  const a=await point(page,30,626),b=await point(page,150,730);
  const source=()=>page.screenshot({clip:{x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y}});
  const before=await source(),saved=await page.evaluate(()=>({...localStorage}));
  const from=await point(page,90,670),to=await point(page,42,178);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:3});await frames(page);
  expect((await source()).equals(before),'Source disappears during actual drag').toBe(false);
  await page.evaluate(()=>window.qaSdk.emit('game_api_pause'));await frames(page);
  await page.mouse.up();await page.evaluate(()=>window.qaSdk.emit('game_api_resume'));await frames(page);await frames(page);
  expect((await source()).equals(before),'SDK pause restores the same source figure').toBe(true);
  expect(await page.evaluate(()=>({...localStorage}))).toEqual(saved);
 });
}
for(const order of ['close-first','resume-first','error','no-fill'] as const) {
 test(`interstitial ${order}: one destination, callbacks never wait for SDK resume`,async({page})=>{
  await sdk(page);await click(page,240,565);await drag(page,0,0,0);
  await page.evaluate(()=>window.qaSdk.offset=100000);
  await click(page,130,759);await click(page,240,450);
  await expect.poll(()=>page.evaluate(()=>window.qaSdk.requests)).toBe(1);
  await page.evaluate(()=>{window.qaSdk.emit('game_api_pause');window.qaSdk.fullscreen?.onOpen?.();});await frames(page);
  if(order==='resume-first') await page.evaluate(()=>window.qaSdk.emit('game_api_resume'));
  await page.evaluate(order=>{
   if(order==='error')window.qaSdk.fullscreen?.onError?.({});else window.qaSdk.fullscreen?.onClose?.(order!=='no-fill');
  },order);
  await expect.poll(async()=>(await snapshot(page)).score).toBe(0);
  if(order!=='resume-first') {await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(0);await page.evaluate(()=>window.qaSdk.emit('game_api_resume'));}
  await frames(page);await frames(page);const ids=(await snapshot(page)).trayIds;
  await page.evaluate(()=>{window.qaSdk.fullscreen?.onClose?.(true);window.qaSdk.fullscreen?.onOpen?.();});await frames(page);
  expect((await snapshot(page)).trayIds).toEqual(ids);await drag(page,0,0,0);expect((await snapshot(page)).score).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(1);
 });
}
test('reward waits for all pause owners, applies once, preserves board and persists across reload',async({page})=>{
 await sdk(page);await click(page,240,565);await drag(page,0,0,0);const before=await snapshot(page);
 await click(page,360,759);await click(page,240,450);
 await expect.poll(()=>page.evaluate(()=>window.qaSdk.rewardRequests)).toBe(1);
 await page.evaluate(()=>{window.qaSdk.emit('game_api_pause');window.dispatchEvent(new Event('pagehide'));window.qaSdk.reward.onRewarded?.();window.qaSdk.reward.onRewarded?.();window.qaSdk.reward.onClose?.();});await frames(page);
 expect((await snapshot(page)).rewardUsed).toBe(false);
 await page.evaluate(()=>window.qaSdk.emit('game_api_resume'));await frames(page);expect((await snapshot(page)).rewardUsed).toBe(false);
 await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await frames(page);
 await expect.poll(async()=>(await snapshot(page)).rewardUsed).toBe(true);
 expect((await snapshot(page)).board).toEqual(before.board);expect((await snapshot(page)).score).toBe(before.score);
 const tray=(await snapshot(page)).trayIds;await page.evaluate(()=>{window.qaSdk.reward.onRewarded?.();window.qaSdk.reward.onClose?.();});expect((await snapshot(page)).trayIds).toEqual(tray);
 await page.reload();await frames(page);await frames(page);expect((await snapshot(page)).rewardUsed).toBe(true);
});
test('reward cancellation and error preserve the tray and release input',async({page})=>{
 await sdk(page);await click(page,240,565);const before=await snapshot(page);
 await click(page,360,759);await click(page,240,518);expect(await page.evaluate(()=>window.qaSdk.rewardRequests)).toBe(0);
 await click(page,360,759);await click(page,240,450);
 await page.evaluate(()=>window.qaSdk.reward.onError?.({}));await frames(page);
 expect((await snapshot(page)).trayIds).toEqual(before.trayIds);expect((await snapshot(page)).rewardUsed).toBe(false);
 await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(1);
});

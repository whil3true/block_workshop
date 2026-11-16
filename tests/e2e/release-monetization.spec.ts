import { test, expect } from './fixtures';
import { sdk } from './sdk-fixture';
import { click, drag, frames, point, snapshot } from './helpers';
import { CAMPAIGN_CATALOG } from '../../src/campaign/CampaignCatalog';
import { CAMPAIGN_KEY } from '../../src/campaign/CampaignStore';
import { WITNESSES, witnessSeed } from '../campaign-witnesses';

test.use({viewport:{width:393,height:852}});
const settled = async (page: import('@playwright/test').Page) => { await frames(page,5); };
async function advance(page: import('@playwright/test').Page,active:number,wall=active) {
 await page.evaluate(({active,wall})=>{window.qaSdk.activeOffset+=active;window.qaSdk.offset+=wall;},{active,wall});await frames(page);
}
async function close(page: import('@playwright/test').Page,shown=false) {
 await page.evaluate(shown=>window.qaSdk.fullscreen?.onClose?.(shown),shown);await settled(page);
}
test('Classic active threshold waits for a completed drag, excludes pauses, retries no-fill and shares exit cooldown',async({page})=>{
 await sdk(page);await click(page,240,580);
 await advance(page,89999,100000);expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(0);
 await page.evaluate(()=>window.qaSdk.emit('game_api_pause'));await advance(page,500000);
 await page.evaluate(()=>window.qaSdk.emit('game_api_resume'));await settled(page);
 // Only one active millisecond is still needed after the long interruption.
 await advance(page,10,10);
 const from=await point(page,90,670),to=await point(page,42,178);
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y);
 expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(0);
 await page.mouse.up();await expect.poll(()=>page.evaluate(()=>window.qaSdk.requests)).toBe(1);
 const saved=await snapshot(page);expect(saved.score).toBe(1);
 await close(page,false);expect(await snapshot(page)).toEqual(saved);
 await drag(page,1,0,1);expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(1);
 await advance(page,15001);await drag(page,2,0,2);
 await expect.poll(()=>page.evaluate(()=>window.qaSdk.requests)).toBe(2);
 await page.evaluate(()=>window.qaSdk.fullscreen?.onOpen?.());await close(page,true);
 await click(page,49,45);expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(2);
 await click(page,240,580);expect((await snapshot(page)).score).toBe(3);
});
test('time spent in menu, settings and orders never creates an automatic ad',async({page})=>{
 await sdk(page);await advance(page,200000);await click(page,240,690);await advance(page,200000);await click(page,240,667);
 await click(page,240,412);await advance(page,200000);await click(page,240,297);await advance(page,200000);
 await drag(page,0,8,4);expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(0);
 await click(page,49,45);await click(page,240,450);expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(0); // Stay.
 await page.keyboard.press('Escape');await click(page,240,518);await expect.poll(()=>page.evaluate(()=>window.qaSdk.requests)).toBe(1);
 await close(page,false);await click(page,240,756);expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(1);
 await click(page,240,580);await drag(page,0,0,0);expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(1);
});
test('Classic exit preserves the selected save; new game clears only after terminal callback',async({page})=>{
 await sdk(page);await click(page,240,580);await drag(page,0,0,0);const before=await snapshot(page);
 await advance(page,0,100000);await click(page,49,45);await expect.poll(()=>page.evaluate(()=>window.qaSdk.requests)).toBe(1);
 expect(await snapshot(page)).toEqual(before);await close(page,false);await click(page,240,580);
 expect(await snapshot(page)).toEqual(before);await advance(page,0,15001);
 await click(page,130,759);await click(page,240,518);expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(1);
 await click(page,130,759);await click(page,240,450);await expect.poll(()=>page.evaluate(()=>window.qaSdk.requests)).toBe(2);
 expect(await snapshot(page)).toEqual(before);
 await page.evaluate(()=>{window.qaSdk.emit('game_api_pause');window.qaSdk.fullscreen?.onOpen?.();window.qaSdk.fullscreen?.onClose?.(true);});
 await expect.poll(async()=>(await snapshot(page)).score).toBe(0);
 await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(0);
 await page.evaluate(()=>window.qaSdk.emit('game_api_resume'));await settled(page);
 await drag(page,0,0,0);expect((await snapshot(page)).score).toBeGreaterThan(0);
});
for(const index of [0,2,17]) {
 test(`order ${index+1}: deferred result action, chapter boundary/final journal, one request`,async({page})=>{
  await page.addInitScript(({key,ids})=>localStorage.setItem(key,JSON.stringify({app:'block-workshop',mode:'campaign',schemaVersion:2,catalogVersion:2,targetRulesVersion:2,completedOrderIds:ids,active:null,notice:null})),
   {key:CAMPAIGN_KEY,ids:CAMPAIGN_CATALOG.slice(0,index).map(o=>o.id)});
  await sdk(page);await click(page,240,412);await click(page,60+Math.floor(index/3)*72,174);
  await page.evaluate(seed=>{const original=crypto.getRandomValues.bind(crypto);Object.defineProperty(crypto,'getRandomValues',{configurable:true,value:<T extends ArrayBufferView>(a:T):T=>{if(a instanceof Uint32Array && a.length===1){a[0]=seed;return a;}return original(a);}});},witnessSeed(CAMPAIGN_CATALOG[index]!.id));
  await click(page,240,297+(index%3)*152);
  for(const [slot,row,col] of WITNESSES[index]!)await drag(page,slot,row,col);
  const earned=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).completedOrderIds as string[],CAMPAIGN_KEY);
  expect(earned).toHaveLength(index+1);await advance(page,0,100000);
  if(index<17)await page.evaluate(seed=>{const original=crypto.getRandomValues.bind(crypto);Object.defineProperty(crypto,'getRandomValues',{configurable:true,value:<T extends ArrayBufferView>(a:T):T=>{if(a instanceof Uint32Array && a.length===1){a[0]=seed;return a;}return original(a);}});},witnessSeed(CAMPAIGN_CATALOG[index+1]!.id));
  await click(page,240,480);await expect.poll(()=>page.evaluate(()=>window.qaSdk.requests)).toBe(1);
  await click(page,240,553);expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(1);
  await page.evaluate(()=>{window.qaSdk.emit('game_api_pause');window.qaSdk.fullscreen?.onOpen?.();window.qaSdk.fullscreen?.onClose?.(false);});
  await settled(page);await page.evaluate(()=>window.qaSdk.emit('game_api_resume'));await settled(page);
  if(index===17) {await click(page,240,756);await click(page,240,580);await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(1);}
  else {
   // Completing the exact next order proves the selected destination survived the ad.
   for(const [slot,row,col] of WITNESSES[index+1]!)await drag(page,slot,row,col);
   expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).completedOrderIds.length,CAMPAIGN_KEY)).toBe(index+2);
  }
 });
}
test('reward needs a successful close, is once per game, and delays the next fullscreen',async({page})=>{
 await sdk(page);await click(page,240,580);const original=await snapshot(page);
 await click(page,360,759);await click(page,240,450);
 await page.evaluate(()=>{window.qaSdk.reward.onRewarded?.();window.qaSdk.reward.onError?.({});});await settled(page);
 expect(await snapshot(page)).toEqual(original);
 await click(page,360,759);await click(page,240,450);
 await page.evaluate(()=>{window.qaSdk.reward.onOpen?.();window.qaSdk.reward.onRewarded?.();window.qaSdk.reward.onClose?.();});await settled(page);
 expect((await snapshot(page)).rewardUsed).toBe(true);const rewarded=await snapshot(page);
 await click(page,360,759);expect(await page.evaluate(()=>window.qaSdk.rewardRequests)).toBe(2);
 await page.evaluate(()=>{window.qaSdk.reward.onRewarded?.();window.qaSdk.reward.onClose?.();});expect(await snapshot(page)).toEqual(rewarded);
 await click(page,49,45);expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(0);
});
for(const locale of ['ru','en']) for(const width of [320,360,393]) {
 test(`text-free Splash and held startup release: ${locale} ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:Math.round(width*800/480)+120});
  await page.addInitScript(locale=>localStorage.setItem('block-workshop:ui-locale',locale),locale);
  await sdk(page,true);await page.screenshot({path:info.outputPath(`splash-${locale}-${width}.png`)});
  await expect(page.locator('button,input')).toHaveCount(0);
  expect(await page.evaluate(()=>({ready:window.qaSdk.ready,starts:window.qaSdk.starts,requests:window.qaSdk.requests}))).toEqual({ready:0,starts:0,requests:0});
  const menu=await point(page,240,580);await page.mouse.move(menu.x,menu.y);await page.mouse.down();
  await page.evaluate(()=>window.qaSdk.emit('game_api_resume'));await settled(page);
  expect(await page.evaluate(()=>window.qaSdk.ready)).toBe(0);
  await page.mouse.up();await settled(page);await expect.poll(()=>page.evaluate(()=>window.qaSdk.ready)).toBe(1);
  expect(await page.evaluate(()=>window.qaSdk.starts)).toBe(0);await expect(page.locator('html')).toHaveAttribute('lang',locale);
  await page.screenshot({path:info.outputPath(`menu-${locale}-${width}.png`)});
  await click(page,240,580);await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(1);
  await page.screenshot({path:info.outputPath(`classic-${locale}-${width}.png`)});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 });
}

test('native Android-style held touch cannot cross startup ad into a menu action',async({page,browserName})=>{
 test.skip(browserName!=='chromium','Native touch via Chromium CDP');
 const client=await page.context().newCDPSession(page);
 await client.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await sdk(page,true);
 const menu=await point(page,240,580);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:menu.x,y:menu.y}]});
 await page.evaluate(()=>window.qaSdk.emit('game_api_resume'));await settled(page);
 expect(await page.evaluate(()=>window.qaSdk.ready)).toBe(0);
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settled(page);
 await expect.poll(()=>page.evaluate(()=>window.qaSdk.ready)).toBe(1);
 expect(await page.evaluate(()=>window.qaSdk.starts)).toBe(0);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[menu]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settled(page);
 expect(await page.evaluate(()=>window.qaSdk.starts)).toBe(1);
 const from=await point(page,90,670),to=await point(page,42,218);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[to]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settled(page);
 expect((await snapshot(page)).score).toBe(1);expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(0);
});

test('completed journal card is an explicit replay transaction; first-time mode/journal selection has no ad',async({page})=>{
 await page.addInitScript(({key,id})=>localStorage.setItem(key,JSON.stringify({app:'block-workshop',mode:'campaign',schemaVersion:2,catalogVersion:2,targetRulesVersion:2,completedOrderIds:[id],active:null,notice:null})),
  {key:CAMPAIGN_KEY,id:CAMPAIGN_CATALOG[0]!.id});
 await sdk(page);await click(page,240,412);await advance(page,0,100000);
 expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(0);
 await click(page,240,297);await expect.poll(()=>page.evaluate(()=>window.qaSdk.requests)).toBe(1);
 expect(await page.evaluate(()=>window.qaSdk.starts)).toBe(0);
 await click(page,240,297);expect(await page.evaluate(()=>window.qaSdk.requests)).toBe(1);
 await close(page,false);expect(await page.evaluate(()=>window.qaSdk.starts)).toBe(1);
 for(const [slot,row,col] of WITNESSES[0]!)await drag(page,slot,row,col);
 await click(page,240,480);for(const [slot,row,col] of WITNESSES[1]!)await drag(page,slot,row,col);
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).completedOrderIds.length,CAMPAIGN_KEY)).toBe(2);
});

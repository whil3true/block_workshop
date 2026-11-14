import { test, expect } from './fixtures';
import { click, drag, frames, open, seed, snapshot } from './helpers';
import { CAMPAIGN_CATALOG } from '../../src/campaign/CampaignCatalog';
import { initialAttempt, type CampaignAttempt } from '../../src/campaign/CampaignSession';
import { CAMPAIGN_KEY, LEGACY_CAMPAIGN_KEY } from '../../src/campaign/CampaignStore';
import { WITNESSES, COLUMN_FIRST, SIMULTANEOUS } from '../campaign-witnesses';
import type { Page } from '@playwright/test';
import type { CellState } from '../../src/engine';
const campaign = (page: Page) => page.evaluate(key=>JSON.parse(localStorage.getItem(key) ?? 'null') as {active:CampaignAttempt;completedOrderIds:string[]}|null,CAMPAIGN_KEY);
async function readyReload(page: Page): Promise<void> { await page.reload();await expect(page.locator('canvas')).toHaveAttribute('aria-busy','false');await frames(page); }
async function seedAttempt(page: Page, active: CampaignAttempt, completedOrderIds: string[] = []): Promise<void> {
 await page.addInitScript(({key,active,completedOrderIds})=>{
  if(sessionStorage.getItem('campaign-seeded'))return;sessionStorage.setItem('campaign-seeded','true');
  localStorage.setItem(key,JSON.stringify({app:'block-workshop',mode:'campaign',schemaVersion:2,catalogVersion:2,targetRulesVersion:2,completedOrderIds,active}));
 },{key:CAMPAIGN_KEY,active,completedOrderIds});
}
test.use({viewport:{width:360,height:640}});
test('three target orders through Canvas drag, partial reload, independent classic and free replay',async({page},info)=>{
 test.setTimeout(180_000);
 await seed(page,{locale:'ru',score:17});await open(page);const classicBefore=await snapshot(page);
 await page.screenshot({path:info.outputPath('menu-ru.png')});await click(page,240,412);await page.screenshot({path:info.outputPath('journal-ru.png')});
 await click(page,240,548);expect(await campaign(page)).toBeNull();
 await click(page,240,278);await page.screenshot({path:info.outputPath('order-01-start.png')});await drag(page,0,8,4);
 const partial=(await campaign(page))!.active;expect(partial.moves).toBe(1);expect(partial.trayIds[0]).toBeNull();
 await click(page,240,117);await page.screenshot({path:info.outputPath('goal-details-ru.png')});
 await click(page,240,667);await readyReload(page);await click(page,240,412);await click(page,240,278);expect((await campaign(page))!.active).toEqual(partial);
 await drag(page,1,8,7);await drag(page,2,8,9);expect((await campaign(page))!.active.status).toBe('succeeded');
 await page.screenshot({path:info.outputPath('order-01-completed.png')});
 for(const index of [1,2]) {
  await click(page,240,480);expect((await campaign(page))!.active.orderId).toBe(CAMPAIGN_CATALOG[index]!.id);
  await page.screenshot({path:info.outputPath(`order-0${index+1}-start.png`)});
  for(const [slot,row,col] of WITNESSES[index]!) {
   await drag(page,slot,row,col);
   if(index===2 && (await campaign(page))!.active.moves===1) {
    expect((await campaign(page))!.active.remainingTargets).toHaveLength(5);
    await page.screenshot({path:info.outputPath('order-03-partial.png')});
    const before=(await campaign(page))!.active;
    // The A card shows two removed original tiles while B is complete and C untouched.
    await click(page,92,117);await page.screenshot({path:info.outputPath('fragment-A-partial.png')});await click(page,240,667);
    await readyReload(page);await click(page,240,412);await click(page,240,548);expect((await campaign(page))!.active).toEqual(before);
   }
  }
  expect((await campaign(page))!.active.status).toBe('succeeded');
 }
 expect((await campaign(page))!.completedOrderIds).toHaveLength(3);
 await page.screenshot({path:info.outputPath('collection-completed.png')});await click(page,240,480);await page.screenshot({path:info.outputPath('journal-completed.png')});
 await click(page,240,278);expect((await campaign(page))!.active).toEqual(initialAttempt(CAMPAIGN_CATALOG[0]!));
 await click(page,49,45);await click(page,49,45);await click(page,240,580);expect(await snapshot(page)).toEqual(classicBefore);
 await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(18);expect((await campaign(page))!.active.moves).toBe(0);
 await page.screenshot({path:info.outputPath('classic-ru.png')});
});
test('campaign RU/EN, goal modal blocks drag, restart confirmation and no rewarded control',async({page},info)=>{
 const browserErrors:string[]=[];page.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text());});
 const imageResponses:string[]=[];page.on('response',r=>{if(/cozy-mosaic\/.*\.(webp|png)$/.test(r.url())&&r.ok())imageResponses.push(r.url());});
 await seed(page);await open(page);await click(page,240,412);await click(page,240,278);
 await click(page,431,45);await click(page,330,230);await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.screenshot({path:info.outputPath('settings-en.png')});await click(page,240,667);
 await page.screenshot({path:info.outputPath('campaign-en.png')});await click(page,240,117);const before=(await campaign(page))!.active;
 await drag(page,0,8,4);expect((await campaign(page))!.active).toEqual(before);await click(page,240,667);
 await click(page,130,759);await click(page,240,518);expect((await campaign(page))!.active).toEqual(before);
 await drag(page,0,8,4);expect((await campaign(page))!.active.moves).toBe(1);await click(page,130,759);await click(page,240,450);
 expect((await campaign(page))!.active).toEqual(initialAttempt(CAMPAIGN_CATALOG[0]!));
 await click(page,360,759);await page.screenshot({path:info.outputPath('journal-en.png')});expect(browserErrors).toEqual([]);
 if(process.env['EXPECT_COZY_ART']==='1')expect(new Set(imageResponses).size).toBe(31);
 if(process.env['EXPECT_COZY_ART']==='0')expect(imageResponses).toHaveLength(0);
});
test('defeat persists after reload; retry is exact and free',async({page},info)=>{
 const initial=initialAttempt(CAMPAIGN_CATALOG[0]!);
 const board:CellState[][]=Array.from({length:10},(_,r)=>Array.from({length:10},(_,c)=>(r+c)%2===0?null:'sq2'));
 for(const address of initial.remainingTargets)board[Math.floor(address/10)]![address%10]=initial.board[Math.floor(address/10)]![address%10]!;
 const active={...initial,board,trayIds:['single','square-3','square-3'],moves:3,nextTrayIndex:2};
 await seedAttempt(page,active);await seed(page);await open(page);await click(page,240,412);await click(page,240,278);await drag(page,0,9,3);
 expect((await campaign(page))!.active.status).toBe('failed');await page.screenshot({path:info.outputPath('order-failed.png')});
 const failed=(await campaign(page))!;await readyReload(page);await click(page,240,412);await click(page,240,278);expect((await campaign(page))!.active).toEqual(failed.active);
 await click(page,240,553);expect((await campaign(page))!.active).toEqual(initial);
});
for(const [label,moves] of [['column first',COLUMN_FIRST],['both axes together',SIMULTANEOUS]] as const) {
 test(`second order clears ${label} without a sequence gate`,async({page},info)=>{
  await seedAttempt(page,initialAttempt(CAMPAIGN_CATALOG[1]!),[CAMPAIGN_CATALOG[0]!.id]);await seed(page,{locale:'en'});await open(page);
  await click(page,240,412);await click(page,240,413);
  for(const [slot,row,col] of moves)await drag(page,slot,row,col);
  expect((await campaign(page))!.active.status).toBe('succeeded');expect((await campaign(page))!.active.remainingTargets).toEqual([]);
  await page.screenshot({path:info.outputPath('independent-clear.png')});
 });
}
test('ordinary replacement on an already cleared target never regains a seal, including reload',async({page},info)=>{
 await seedAttempt(page,initialAttempt(CAMPAIGN_CATALOG[2]!),CAMPAIGN_CATALOG.slice(0,2).map(o=>o.id));await seed(page);await open(page);await click(page,240,412);await click(page,240,548);
 for(const [slot,row,col] of WITNESSES[2].slice(0,3))await drag(page,slot,row,col);
 const before=(await campaign(page))!.active;expect(before.remainingTargets).toHaveLength(5);
 await drag(page,0,4,1);const after=(await campaign(page))!.active;
 expect(after.board[4]![1]).not.toBeNull();expect(after.remainingTargets).toEqual(before.remainingTargets);expect(after.remainingTargets).not.toContain(41);
 await page.screenshot({path:info.outputPath('ordinary-replacement.png')});
 await readyReload(page);await click(page,240,412);await click(page,240,548);expect((await campaign(page))!.active).toEqual(after);
 await click(page,92,117);await page.screenshot({path:info.outputPath('silhouette-after-replacement.png')});
});
test('old test campaign resets with a persistent notice while Classic and settings remain',async({page},info)=>{
 await page.addInitScript(key=>{
  if(sessionStorage.getItem('legacy-seeded'))return;sessionStorage.setItem('legacy-seeded','true');
  localStorage.setItem(key,JSON.stringify({schemaVersion:1,completedOrderIds:['ch01-order01'],active:{stage:1,count:0}}));
  localStorage.setItem('block-workshop:audio-settings','{"musicVolume":0.3,"sfxVolume":0.8}');
 },LEGACY_CAMPAIGN_KEY);
 await seed(page,{locale:'en',score:31});await open(page);const classic=await snapshot(page);
 await click(page,240,412);await page.screenshot({path:info.outputPath('migration-notice.png')});
 const raw=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),CAMPAIGN_KEY);expect(raw.notice).toBe('updated');expect(raw.completedOrderIds).toEqual([]);
 await readyReload(page);await click(page,240,412);await click(page,240,508);
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).notice,CAMPAIGN_KEY)).toBeNull();
 await click(page,240,278);expect((await campaign(page))!.active).toEqual(initialAttempt(CAMPAIGN_CATALOG[0]!));expect(await snapshot(page)).toEqual(classic);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('block-workshop:audio-settings')!))).toMatchObject({musicVolume:.3,sfxVolume:.8});
});
for(const width of [320,360])for(const locale of ['ru','en'])test(`equal menu cards, three-fragment HUD and landscape paper at ${width}px ${locale}`,async({page},info)=>{
 await seedAttempt(page,initialAttempt(CAMPAIGN_CATALOG[2]!),CAMPAIGN_CATALOG.slice(0,2).map(o=>o.id));await seed(page,{locale,score:12345});await page.setViewportSize({width,height:Math.round(width*16/9)});await open(page);
 await page.screenshot({path:info.outputPath(`menu-${locale}-${width}.png`)});
 await click(page,240,412);await page.screenshot({path:info.outputPath('back-centered.png')});await click(page,240,548);
 await page.screenshot({path:info.outputPath(`three-fragments-${locale}-${width}.png`)});await drag(page,0,4,3);expect((await campaign(page))!.active.remainingTargets).toHaveLength(5);
 await page.setViewportSize({width:852,height:393});await frames(page);await frames(page);
 const paper=await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundImage);
 if(process.env['EXPECT_COZY_ART']==='1')expect(paper).toContain('paper.webp');
 await page.screenshot({path:info.outputPath(`landscape-${locale}.png`)});await drag(page,1,6,6);expect((await campaign(page))!.active.moves).toBe(2);
 await page.setViewportSize({width:1280,height:800});await frames(page);await page.screenshot({path:info.outputPath(`desktop-${locale}.png`)});
});

for(const locale of ['ru','en'])for(const index of [0,1,2])test(`balanced ${index+1}-goal HUD and completed journal ${locale}`,async({page},info)=>{
 await seedAttempt(page,initialAttempt(CAMPAIGN_CATALOG[index]!),CAMPAIGN_CATALOG.map(o=>o.id));
 await seed(page,{locale});await open(page);await click(page,240,412);
 await page.screenshot({path:info.outputPath(`journal-completed-${locale}.png`)});
 await click(page,240,278+index*135);
 await page.screenshot({path:info.outputPath(`goals-${index+1}-${locale}.png`)});
 // Preserve each entire capsule's original hit area, including both edge cards.
 const count=CAMPAIGN_CATALOG[index]!.fragments.length;
 const width=(464-(count-1)*6)/count;
 for(let i=0;i<count;i++){
  await click(page,8+width/2+i*(width+6),113);
  await page.screenshot({path:info.outputPath(`goal-${i+1}-details-${locale}.png`)});
  await click(page,240,667);
 }
 expect((await campaign(page))!.active.moves).toBe(0);
});

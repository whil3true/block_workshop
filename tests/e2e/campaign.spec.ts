import { test, expect } from './fixtures';
import { click, drag, frames, open, seed, snapshot } from './helpers';
import { CAMPAIGN_CATALOG } from '../../src/campaign/CampaignCatalog';
import { initialAttempt } from '../../src/campaign/CampaignSession';
import { CAMPAIGN_KEY } from '../../src/campaign/CampaignStore';
import type { CampaignAttempt } from '../../src/campaign/CampaignSession';
import { WITNESSES } from '../campaign-witnesses';
import type { Page } from '@playwright/test';
const campaign = (page: Page) => page.evaluate(key=>JSON.parse(localStorage.getItem(key) ?? 'null') as {active:CampaignAttempt;completedOrderIds:string[]}|null,CAMPAIGN_KEY);
async function readyReload(page: Page): Promise<void> { await page.reload();await expect(page.locator('canvas')).toHaveAttribute('aria-busy','false');await frames(page); }
test.use({viewport:{width:360,height:640}});
test('three orders through real Canvas drag, partial-tray reload, results, independent classic and free replay',async({page},info)=>{
 // This journey plays all three orders, reloads twice and returns to classic.
 // Hosted Chromium software WebGL exceeds the ordinary single-screen 60s budget.
 // Keep assertion timeouts unchanged; only budget the complete user journey.
 test.setTimeout(120_000);
 await seed(page,{locale:'ru',score:17});await open(page);const classicBefore=await snapshot(page);
 await page.screenshot({path:info.outputPath('menu-ru.png')});
 await click(page,240,412);await page.screenshot({path:info.outputPath('journal-ru.png')});
 // Future content and locked orders have no actionable start target.
 await click(page,240,548);expect(await campaign(page)).toBeNull();
 await click(page,240,278);await drag(page,0,8,4);
 const partial=(await campaign(page))!.active;expect(partial.moves).toBe(1);expect(partial.trayIds[0]).toBeNull();
 await click(page,240,113);await page.screenshot({path:info.outputPath('goal-details-ru.png')});
 await click(page,240,667);await readyReload(page);await click(page,240,412);await click(page,240,278);
 expect((await campaign(page))!.active).toEqual(partial);
 await drag(page,1,8,7);await drag(page,2,8,9);
 await expect.poll(async()=>(await campaign(page))?.active.status).toBe('succeeded');
 await page.screenshot({path:info.outputPath('order-01-completed.png')});
 for(const index of [1,2]) {
  await click(page,240,480);expect((await campaign(page))!.active.orderId).toBe(CAMPAIGN_CATALOG[index]!.id);
  await page.screenshot({path:info.outputPath(`order-0${index+1}.png`)});
  for(const [slot,row,col] of WITNESSES[index]!) {
   await drag(page,slot,row,col);
   if(index===2 && (await campaign(page))!.active.stage===1 && (await campaign(page))!.active.moves===2) {
    await page.screenshot({path:info.outputPath('target-column-07.png')});
    const before=(await campaign(page))!.active;await readyReload(page);await click(page,240,412);await click(page,240,548);expect((await campaign(page))!.active).toEqual(before);
   }
  }
  expect((await campaign(page))!.active.status).toBe('succeeded');
 }
 expect((await campaign(page))!.completedOrderIds).toHaveLength(3);
 await page.screenshot({path:info.outputPath('collection-completed.png')});
 await click(page,240,480);await page.screenshot({path:info.outputPath('journal-completed.png')});
 await click(page,240,278);expect((await campaign(page))!.active.status).toBe('running');expect((await campaign(page))!.completedOrderIds).toHaveLength(3);
 await click(page,49,45);await click(page,49,45);await click(page,240,565);expect(await snapshot(page)).toEqual(classicBefore);
 await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(18);expect((await campaign(page))!.active.moves).toBe(0);
 await page.screenshot({path:info.outputPath('classic-ru.png')});
});
test('campaign settings RU/EN, goal modal blocks drag, restart confirmation and no rewarded control',async({page},info)=>{
 const browserErrors:string[]=[];page.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text());});
 const imageResponses:string[]=[];page.on('response',r=>{if(/cozy-mosaic\/.*\.(webp|png)$/.test(r.url())&&r.ok())imageResponses.push(r.url());});
 await seed(page);await open(page);await click(page,240,412);await click(page,240,278);
 await click(page,431,45);await click(page,330,230);await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.screenshot({path:info.outputPath('settings-en.png')});await click(page,240,667);
 await page.screenshot({path:info.outputPath('campaign-en.png')});await click(page,240,113);const before=(await campaign(page))!.active;
 await drag(page,0,8,4);expect((await campaign(page))!.active).toEqual(before);await click(page,240,667);
 await click(page,130,759);await click(page,240,518);expect((await campaign(page))!.active).toEqual(before);
 await drag(page,0,8,4);expect((await campaign(page))!.active.moves).toBe(1);await click(page,130,759);await click(page,240,450);
 expect((await campaign(page))!.active.moves).toBe(0);expect((await campaign(page))!.active.trayIds).toEqual(before.trayIds);
 // Campaign's lower right action opens the journal, never a rewarded offer.
 await click(page,360,759);await page.screenshot({path:info.outputPath('journal-en.png')});
 expect(browserErrors).toEqual([]);
 if(process.env['EXPECT_COZY_ART']==='1')expect(new Set(imageResponses).size).toBe(31);
});
test('campaign defeat persists after reload and retry is exact and free',async({page},info)=>{
 const active={...initialAttempt(CAMPAIGN_CATALOG[0]!),board:Array.from({length:10},(_,r)=>Array.from({length:10},(_,c)=>(r+c)%2===0?null:'sq2')),trayIds:['single','square-3','square-3']};
 await page.addInitScript(({key,active})=>localStorage.setItem(key,JSON.stringify({app:'block-workshop',mode:'campaign',schemaVersion:1,catalogVersion:1,completedOrderIds:[],active})),{key:CAMPAIGN_KEY,active});
 await seed(page);await open(page);await click(page,240,412);await click(page,240,278);await drag(page,0,0,0);
 expect((await campaign(page))!.active.status).toBe('failed');await page.screenshot({path:info.outputPath('order-failed.png')});
 // Capture the persisted failure in a clean reload without running the fixture again.
 const failed=(await campaign(page))!;await page.context().clearCookies();
 await page.addInitScript(({key,failed})=>localStorage.setItem(key,JSON.stringify({app:'block-workshop',mode:'campaign',schemaVersion:1,catalogVersion:1,...failed})),{key:CAMPAIGN_KEY,failed});
 await readyReload(page);await click(page,240,412);await click(page,240,278);expect((await campaign(page))!.active.status).toBe('failed');
 await click(page,240,553);expect((await campaign(page))!.active).toEqual(initialAttempt(CAMPAIGN_CATALOG[0]!));
});

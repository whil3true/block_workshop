import { test, expect } from './fixtures';
import { click, drag, frames, open, point, seed, snapshot } from './helpers';
import { CAMPAIGN_CATALOG } from '../../src/campaign/CampaignCatalog';
import { initialAttempt, placeCampaign, type CampaignAttempt } from '../../src/campaign/CampaignSession';
import { CAMPAIGN_KEY, LEGACY_CAMPAIGN_KEY } from '../../src/campaign/CampaignStore';
import { WITNESSES, COLUMN_FIRST, SIMULTANEOUS } from '../campaign-witnesses';
import type { Page } from '@playwright/test';
import type { CellState } from '../../src/engine';

type StoredCampaign = { active: null; completedOrderIds: string[]; notice: string | null };
const campaign = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null') as StoredCampaign | null,CAMPAIGN_KEY);
async function readyReload(page: Page): Promise<void> {
 await page.reload();
 await expect(page.locator('canvas')).toHaveAttribute('aria-busy','false');
 await frames(page);
}
async function seedAchievements(page: Page, completedOrderIds: string[] = [], oldAttempt: CampaignAttempt | null = null): Promise<void> {
 await page.addInitScript(({key,completedOrderIds,oldAttempt})=>{
  if(sessionStorage.getItem('campaign-seeded'))return;
  sessionStorage.setItem('campaign-seeded','true');
  localStorage.setItem(key,JSON.stringify({
   app:'block-workshop', mode:'campaign', schemaVersion:2, catalogVersion:2, targetRulesVersion:2,
   completedOrderIds, active:oldAttempt, notice:null,
  }));
 },{key:CAMPAIGN_KEY,completedOrderIds,oldAttempt});
}
const complete = (page: Page, moves: readonly (readonly [number,number,number])[]) =>
 moves.reduce<Promise<void>>(async (previous,[slot,row,col])=>{await previous;await drag(page,slot,row,col);},Promise.resolve());

const dragMove = (page: Page, move: readonly number[]) => drag(page,move[0]!,move[1]!,move[2]!);
const boardPixels = async (page: Page) => {
 const a=await point(page,20,156), b=await point(page,460,596);
 return page.screenshot({clip:{x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y}});
};
test.use({viewport:{width:360,height:640}});

test('all three orders: exit and reload discard partial play but earned completions and Classic remain',async({page},info)=>{
 test.setTimeout(180_000);
 await seed(page,{locale:'ru',score:17});
 await open(page);
 const classicBefore=await snapshot(page);
 await page.screenshot({path:info.outputPath('menu-ru.png')});
 await click(page,240,412);await page.screenshot({path:info.outputPath('journal-ru.png')});
 await click(page,240,278);
 await drag(page,0,8,4);
 expect((await campaign(page))?.active??null).toBeNull();
 await click(page,240,117);await page.screenshot({path:info.outputPath('goal-details-ru.png')});await click(page,240,667);
 await click(page,49,45); // Warn before abandoning order 01.
 await page.screenshot({path:info.outputPath('leave-order-confirm-ru.png')});
 await click(page,240,518); // Confirm discard.
 await click(page,240,278);
 // Same first slot and position must be available again, proving a fresh attempt.
 await complete(page,WITNESSES[0]);
 expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[0]!.id);
 await page.screenshot({path:info.outputPath('order-01-completed.png')});
 await click(page,240,480); // Order 02 from victory.
 await complete(page,WITNESSES[1]);
 expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[1]!.id);
 await click(page,240,480); // Order 03 from victory.
 await dragMove(page,WITNESSES[2]![0]!);
 await page.screenshot({path:info.outputPath('order-03-partial.png')});
 await click(page,92,117);await page.screenshot({path:info.outputPath('fragment-A-partial.png')});await click(page,240,667);
 await readyReload(page); // A page reload also abandons an incomplete order.
 await click(page,240,412);await click(page,240,548);
 await complete(page,WITNESSES[2]);
 expect((await campaign(page))?.completedOrderIds).toHaveLength(3);
 expect((await campaign(page))?.active??null).toBeNull();
 await page.screenshot({path:info.outputPath('collection-completed.png')});
 await click(page,240,626); // Last victory -> menu.
 await click(page,240,412);
 await page.screenshot({path:info.outputPath('journal-completed.png')});
 await click(page,49,45);await click(page,240,580);
 expect(await snapshot(page)).toEqual(classicBefore);
 await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(18);
});

for(const [index,order] of CAMPAIGN_CATALOG.entries()){
 test(`order ${index+1} always restarts after leaving for another order, even when previously completed`,async({page},info)=>{
  await seedAchievements(page,CAMPAIGN_CATALOG.map(o=>o.id));
  await seed(page,{locale:'en'});await open(page);await click(page,240,412);
  await click(page,240,278+index*135);
  await dragMove(page,WITNESSES[index]![0]!);
  expect((await campaign(page))?.active??null).toBeNull();
  await click(page,49,45); // Leave the partial attempt.
  await click(page,240,518); // Confirm discard.
  const other=index===0?1:0;
  await click(page,240,278+other*135);
  await click(page,49,45);
  await click(page,240,278+index*135);
  const initial=await page.screenshot({path:info.outputPath(`order-${index+1}-restart-initial.png`)});
  await dragMove(page,WITNESSES[index]![0]!);
  const after=await page.screenshot({path:info.outputPath(`order-${index+1}-restart-first-move.png`)});
  expect(after.equals(initial),'Restarted order should accept first piece again').toBe(false);
  await complete(page,WITNESSES[index]!.slice(1));
  expect((await campaign(page))?.completedOrderIds).toContain(order.id);
  expect((await campaign(page))?.active??null).toBeNull();
 });
}

test('settings and goal detail modals block dragging; restart confirmation still works',async({page},info)=>{
 const browserErrors:string[]=[];page.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text());});
 const imageResponses:string[]=[];page.on('response',r=>{if(/cozy-mosaic\/.*\.(webp|png)$/.test(r.url())&&r.ok())imageResponses.push(r.url());});
 await seed(page);await open(page);await click(page,240,412);await click(page,240,278);
 await click(page,431,45);await click(page,330,230);
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.screenshot({path:info.outputPath('settings-en.png')});await click(page,240,667);
 await click(page,240,117);await drag(page,0,8,4);await click(page,240,667);
 // First placement still works after an attempted drag behind a modal.
 await drag(page,0,8,4);expect((await campaign(page))?.active??null).toBeNull();
 await click(page,130,759);await click(page,240,518); // Cancel restart.
 await drag(page,1,8,7);await drag(page,2,8,9);
 expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[0]!.id);
 await click(page,240,626);await page.screenshot({path:info.outputPath('journal-en.png')});
 expect(browserErrors).toEqual([]);
 if(process.env['EXPECT_COZY_ART']==='1')expect(new Set(imageResponses).size).toBe(31);
 if(process.env['EXPECT_COZY_ART']==='0')expect(imageResponses).toHaveLength(0);
});

test('a legacy v2 failed snapshot is ignored, keeping earned order completion',async({page},info)=>{
 const initial=initialAttempt(CAMPAIGN_CATALOG[0]!);
 const board:CellState[][]=Array.from({length:10},(_,r)=>Array.from({length:10},(_,c)=>(r+c)%2===0?null:'sq2'));
 for(const cell of initial.remainingTargets)board[Math.floor(cell/10)]![cell%10]=initial.board[Math.floor(cell/10)]![cell%10]!;
 const failed=placeCampaign({...initial,board,trayIds:['single','square-3','square-3']},0,9,3);
 expect(failed.status).toBe('failed');
 await seedAchievements(page,[CAMPAIGN_CATALOG[0]!.id],failed);
 await seed(page,{locale:'ru'});await open(page);await click(page,240,412);
 expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[0]!.id);
 await page.screenshot({path:info.outputPath('completed-journal-with-legacy-failed-snapshot.png')});
 await click(page,240,278);
 await complete(page,WITNESSES[0]); // New game, no stale failure dialog.
 expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[0]!.id);
});

for(const [label,moves] of [['column first',COLUMN_FIRST],['both axes together',SIMULTANEOUS]] as const){
 test(`second order clears ${label} without a sequence gate`,async({page},info)=>{
  await seedAchievements(page,[CAMPAIGN_CATALOG[0]!.id]);
  await seed(page,{locale:'en'});await open(page);await click(page,240,412);await click(page,240,413);
  await complete(page,moves);
  expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[1]!.id);
  await page.screenshot({path:info.outputPath('independent-clear.png')});
 });
}

test('ordinary replacement on a cleared target stays ordinary until exit; reload starts fresh',async({page},info)=>{
 await seedAchievements(page,CAMPAIGN_CATALOG.slice(0,2).map(o=>o.id));
 await seed(page);await open(page);await click(page,240,412);await click(page,240,548);
 await complete(page,WITNESSES[2]!.slice(0,3));
 await drag(page,0,4,1);
 await page.screenshot({path:info.outputPath('ordinary-replacement.png')});
 expect((await campaign(page))?.active??null).toBeNull();
 await readyReload(page);await click(page,240,412);await click(page,240,548);
 await complete(page,WITNESSES[2]);
 expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[2]!.id);
});

test('old v1 campaign reset notice remains and does not touch Classic or settings',async({page},info)=>{
 await page.addInitScript(key=>{
  if(sessionStorage.getItem('legacy-seeded'))return;sessionStorage.setItem('legacy-seeded','true');
  localStorage.setItem(key,JSON.stringify({schemaVersion:1,completedOrderIds:['ch01-order01'],active:{stage:1,count:0}}));
  localStorage.setItem('block-workshop:audio-settings','{"musicVolume":0.3,"sfxVolume":0.8}');
 },LEGACY_CAMPAIGN_KEY);
 await seed(page,{locale:'en',score:31});await open(page);const classic=await snapshot(page);
 await click(page,240,412);await page.screenshot({path:info.outputPath('migration-notice.png')});
 const raw=await campaign(page);expect(raw?.notice).toBe('updated');expect(raw?.completedOrderIds).toEqual([]);
 await readyReload(page);await click(page,240,412);await click(page,240,508);
 expect((await campaign(page))?.notice).toBeNull();
 await click(page,240,278);
 expect((await campaign(page))?.active??null).toBeNull();
 expect(await snapshot(page)).toEqual(classic);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('block-workshop:audio-settings')!))).toMatchObject({musicVolume:.3,sfxVolume:.8});
});

for(const width of [320,360])for(const locale of ['ru','en'])
 test(`equal menu cards, three-fragment HUD and landscape paper at ${width}px ${locale}`,async({page},info)=>{
  await seedAchievements(page,CAMPAIGN_CATALOG.slice(0,2).map(o=>o.id));
  await seed(page,{locale,score:12345});await page.setViewportSize({width,height:Math.round(width*16/9)});await open(page);
  await page.screenshot({path:info.outputPath(`menu-${locale}-${width}.png`)});
  await click(page,240,412);await page.screenshot({path:info.outputPath('back-centered.png')});await click(page,240,548);
  await page.screenshot({path:info.outputPath(`three-fragments-${locale}-${width}.png`)});
  await dragMove(page,WITNESSES[2]![0]!);
  await page.setViewportSize({width:852,height:393});await frames(page);await frames(page);
  const paper=await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundImage);
  if(process.env['EXPECT_COZY_ART']==='1')expect(paper).toContain('paper.webp');
  await page.screenshot({path:info.outputPath(`landscape-${locale}.png`)});
  await dragMove(page,WITNESSES[2]![1]!);
  await page.setViewportSize({width:1280,height:800});await frames(page);
  await page.screenshot({path:info.outputPath(`desktop-${locale}.png`)});
 });

for(const locale of ['ru','en'])for(const index of [0,1,2])
 test(`balanced ${index+1}-goal HUD and completed journal ${locale}`,async({page},info)=>{
  await seedAchievements(page,CAMPAIGN_CATALOG.map(o=>o.id));
  await seed(page,{locale});await open(page);await click(page,240,412);
  await page.screenshot({path:info.outputPath(`journal-completed-${locale}.png`)});
  await click(page,240,278+index*135);
  await page.screenshot({path:info.outputPath(`goals-${index+1}-${locale}.png`)});
  const count=CAMPAIGN_CATALOG[index]!.fragments.length, width=(464-(count-1)*6)/count;
  for(let i=0;i<count;i++){
   await click(page,8+width/2+i*(width+6),113);
   await page.screenshot({path:info.outputPath(`goal-${i+1}-details-${locale}.png`)});
   await click(page,240,667);
  }
  expect((await campaign(page))?.completedOrderIds).toHaveLength(3);
 });

for(const locale of ['ru','en'] as const) {
 test(`campaign back warning lets player stay, then confirms discard (${locale})`,async({page},info)=>{
  await seed(page,{locale});await open(page);await click(page,240,412);await click(page,240,278);
  await drag(page,0,8,4); // A changed, unfinished order.
  const before=await boardPixels(page);
  await click(page,49,45);
  const warning=await page.screenshot({path:info.outputPath(`leave-warning-${locale}.png`)});
  expect(warning.byteLength).toBeGreaterThan(0);
  expect((await campaign(page))?.active??null).toBeNull();
  await click(page,240,450); // Keep playing.
  const returned=await boardPixels(page);
  expect(returned.equals(before),'Cancel leaves current board intact').toBe(true);
  await drag(page,1,8,7); // Still the same incomplete attempt, not reset.
  await click(page,49,45);await click(page,240,518); // Confirm leave.
  const journal=await page.screenshot({path:info.outputPath(`journal-after-confirm-${locale}.png`)});
  await click(page,240,278); // Reenter starts at the beginning.
  const fresh=await page.screenshot();
  expect(fresh.equals(journal),'Confirmation navigates away from the game').toBe(false);
  await complete(page,WITNESSES[0]);
  expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[0]!.id);
 });
}

test('no warning before the first move; bottom Orders button confirms after a move',async({page},info)=>{
 await seed(page,{locale:'ru'});await open(page);await click(page,240,412);await click(page,240,278);
 await click(page,49,45); // No progress yet, so leave directly.
 await click(page,240,278);await drag(page,0,8,4);
 const before=await boardPixels(page);
 await click(page,360,759); // The lower Orders button must warn too.
 await page.screenshot({path:info.outputPath('orders-button-exit-warning.png')});
 await click(page,240,450); // Keep playing.
 expect((await boardPixels(page)).equals(before)).toBe(true);
 await click(page,360,759);await click(page,240,518); // Confirm exit.
 await click(page,240,278);
 await complete(page,WITNESSES[0]);
 expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[0]!.id);
});

test('Esc confirms unfinished campaign exit to main menu, with cancellation available',async({page},info)=>{
 await seed(page,{locale:'en'});await open(page);await click(page,240,412);await click(page,240,278);
 await drag(page,0,8,4);
 const before=await boardPixels(page);
 await page.keyboard.press('Escape');
 await page.keyboard.press('Escape'); // Close confirmation without leaving.
 expect((await boardPixels(page)).equals(before)).toBe(true);
 await page.keyboard.press('Escape');await click(page,240,518); // Confirm to menu.
 await click(page,240,412);await click(page,240,278);
 await complete(page,WITNESSES[0]);
 expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[0]!.id);
});

test('completed campaign result can return to menu without exit warning',async({page},info)=>{
 await seed(page,{locale:'en'});await open(page);await click(page,240,412);await click(page,240,278);
 await complete(page,WITNESSES[0]);
 await click(page,240,626); // Existing result action is not intercepted.
 await page.screenshot({path:info.outputPath('completed-order-return.png')});
 await click(page,240,412);
 expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[0]!.id);
});

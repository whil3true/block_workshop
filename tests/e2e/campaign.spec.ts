import { test, expect } from './fixtures';
import { click, drag, frames, open, point, seed, snapshot } from './helpers';
import { CAMPAIGN_CATALOG } from '../../src/campaign/CampaignCatalog';
import { initialAttempt, placeCampaign, type CampaignAttempt } from '../../src/campaign/CampaignSession';
import { CAMPAIGN_KEY, LEGACY_CAMPAIGN_KEY } from '../../src/campaign/CampaignStore';
import { WITNESSES, COLUMN_FIRST, SIMULTANEOUS, RECOVERY_PATHS, DEFEAT_18, witnessSeed, recoverySeed } from '../campaign-witnesses';
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

async function selectOrder(page: Page,index: number): Promise<void> {
 await click(page,60+Math.floor(index/3)*72,174);
 const card=index%3;
 await campaignSeed(page,[witnessSeed(CAMPAIGN_CATALOG[index]!.id)]);
 await click(page,240,278+(card%3)*135);
}

/** Replace only entropy in the test browser; production has no QA seed URL or debug hook. */
async function campaignSeed(page:Page,seeds:number[]):Promise<void>{
 await page.evaluate(seeds=>{
  let cursor=0;const original=crypto.getRandomValues.bind(crypto);
  Object.defineProperty(crypto,'getRandomValues',{configurable:true,value:<T extends ArrayBufferView>(array:T):T=>{
   if(array instanceof Uint32Array && array.length===1){array[0]=seeds[Math.min(cursor++,seeds.length-1)]!;return array;}
   return original(array);
  }});
 },seeds);
}
const dragMove = (page: Page, move: readonly number[]) => drag(page,move[0]!,move[1]!,move[2]!);
const boardPixels = async (page: Page) => {
 const a=await point(page,20,156), b=await point(page,460,596);
 return page.screenshot({clip:{x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y}});
};
test.use({viewport:{width:360,height:640}});

test('first three orders: exit and reload discard partial play but earned completions and Classic remain',async({page},info)=>{
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
 await page.screenshot({path:info.outputPath('first-three-completed.png')});
 await click(page,240,626); // Order 03 result -> chapter journal.
 await page.screenshot({path:info.outputPath('journal-completed.png')});
 await click(page,240,756);await click(page,240,580);
 expect(await snapshot(page)).toEqual(classicBefore);
 await drag(page,0,0,0);expect((await snapshot(page)).score).toBe(18);
});

for(const [index,order] of CAMPAIGN_CATALOG.entries()){
 test(`order ${index+1} always restarts after leaving for another order, even when previously completed`,async({page},info)=>{
  await seedAchievements(page,CAMPAIGN_CATALOG.map(o=>o.id));
  await seed(page,{locale:'en'});await open(page);await click(page,240,412);
  await selectOrder(page,index);
  await dragMove(page,WITNESSES[index]![0]!);
  expect((await campaign(page))?.active??null).toBeNull();
  await click(page,49,45); // Leave the partial attempt.
  await click(page,240,518); // Confirm discard.
  const other=index===0?1:0;
  await selectOrder(page,other);
  await click(page,49,45);
  await selectOrder(page,index);
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

for(const width of [320,360,393])for(const locale of ['ru','en'])
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
  await selectOrder(page,index);
  await page.screenshot({path:info.outputPath(`goals-${index+1}-${locale}.png`)});
  const count=CAMPAIGN_CATALOG[index]!.fragments.length, width=(464-(count-1)*6)/count;
  for(let i=0;i<count;i++){
   await click(page,8+width/2+i*(width+6),113);
   await page.screenshot({path:info.outputPath(`goal-${i+1}-details-${locale}.png`)});
   await click(page,240,667);
  }
  expect((await campaign(page))?.completedOrderIds).toHaveLength(18);
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

test('Esc exit confirmation can be cancelled without restarting the unfinished order',async({page})=>{
 await seed(page,{locale:'en'});await open(page);await click(page,240,412);await click(page,240,278);
 await drag(page,0,8,4);
 await page.keyboard.press('Escape');await frames(page); // Render the exit warning before sending the next key.
 await page.keyboard.press('Escape'); // Dismiss warning and keep the active order.
 await frames(page);
 // Remaining solution moves must still complete the SAME attempt.
 // A reset would restore the first piece and this two-move suffix could not finish.
 await complete(page,WITNESSES[0]!.slice(1));
 expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[0]!.id);
});

test('Esc confirms unfinished campaign exit to main menu and re-entry starts fresh',async({page})=>{
 await seed(page,{locale:'en'});await open(page);await click(page,240,412);await click(page,240,278);
 await drag(page,0,8,4);
 await page.keyboard.press('Escape'); // Open exit warning.
 await click(page,240,518); // Confirm exit to menu.
 await click(page,240,412);await click(page,240,278);
 // A fresh attempt must accept the complete original solution.
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

// Real Canvas input with an UNCOMPLETED selected order. A saved new ID proves the
// game accepted the drags and reached its result; replaying an already-earned ID cannot do that.
for(const [index] of CAMPAIGN_CATALOG.entries()) {
 test(`constructive Canvas solution earns order ${index+1}`,async({page},info)=>{
  await seedAchievements(page,CAMPAIGN_CATALOG.slice(0,index).map(o=>o.id));
  await seed(page,{locale:index%2?'en':'ru',score:42});await open(page);
  const classic=await snapshot(page);
  await click(page,240,412);await selectOrder(page,index);
  await complete(page,WITNESSES[index]!);
  expect((await campaign(page))?.completedOrderIds).toEqual(CAMPAIGN_CATALOG.slice(0,index+1).map(o=>o.id));
  expect(await snapshot(page)).toEqual(classic);
  await page.screenshot({path:info.outputPath(`order-${String(index+1).padStart(2,'0')}-won.png`)});
  if([2,5,8,11,14].includes(index)) {
   await campaignSeed(page,[witnessSeed(CAMPAIGN_CATALOG[index+1]!.id)]);
   await click(page,240,480); // Cross a chapter boundary using the real victory action.
   await complete(page,WITNESSES[index+1]!);
   expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[index+1]!.id);
   await click(page,240,626); // Journal follows the chapter entered by Next order.
   await page.screenshot({path:info.outputPath(`chapter-${Math.floor(index/3)+2}-after-next.png`)});
  }
  if(index===17) {
   await click(page,240,480); // Final collection -> journal, with three of three in chapter 6.
   await page.screenshot({path:info.outputPath('final-collection-journal.png')});

  }
 });
}

for(const index of [3,8,11,14,17]) {
 test(`Canvas recovery after a misplaced opening piece in order ${index+1}`,async({page})=>{
  await seedAchievements(page,CAMPAIGN_CATALOG.slice(0,index).map(o=>o.id));
  await seed(page);await open(page);await click(page,240,412);await selectOrder(page,index);
  await campaignSeed(page,[recoverySeed(CAMPAIGN_CATALOG[index]!.id)]);
  await click(page,130,759);await click(page,240,450);
  await complete(page,RECOVERY_PATHS[index]!);
  expect((await campaign(page))?.completedOrderIds).toContain(CAMPAIGN_CATALOG[index]!.id);
 });
}

for(const locale of ['ru','en'])for(const width of [320,360,393]) {
 test(`six complete chapter layouts ${locale} ${width}px, legacy three-order save`,async({page},info)=>{
  // This is the exact v2 achievements-only shape shipped before expansion.
  await seedAchievements(page,CAMPAIGN_CATALOG.slice(0,3).map(o=>o.id));
  await seed(page,{locale});await page.setViewportSize({width,height:Math.round(width*16/9)});await open(page);
  await click(page,240,412);
  for(let chapter=1;chapter<=6;chapter++) {
   await click(page,60+(chapter-1)*72,174);
   await page.screenshot({path:info.outputPath(`chapter-${chapter}-${locale}-${width}.png`)});
   // Selecting a locked late card leaves the journal intact and does not earn anything.
   if(chapter>1){const before=await boardPixels(page);await click(page,240,548);
   expect((await boardPixels(page)).equals(before)).toBe(true);}
  }
  expect((await campaign(page))?.notice).toBeNull();
  expect((await campaign(page))?.completedOrderIds).toEqual(CAMPAIGN_CATALOG.slice(0,3).map(o=>o.id));
  await selectOrder(page,3);await complete(page,WITNESSES[3]!);
  expect((await campaign(page))?.completedOrderIds).toHaveLength(4);
 });
}


// Keep the full original crowding path, but give defeat/navigation its own budget.
test('real crowded order 18 reaches defeat and returns to chapter 6',async({page},info)=>{
 await seedAchievements(page,CAMPAIGN_CATALOG.slice(0,17).map(o=>o.id));
 await seed(page,{locale:'en'});await open(page);await click(page,240,412);await selectOrder(page,17);
 await campaignSeed(page,[17]);await click(page,130,759);await click(page,240,450);
 await complete(page,DEFEAT_18);
 expect((await campaign(page))?.completedOrderIds).toHaveLength(17);
 await page.screenshot({path:info.outputPath('order-18-real-defeat.png')});
 await click(page,240,480);
 await page.screenshot({path:info.outputPath('order-18-defeat-chapter-6.png')});
 await campaignSeed(page,[witnessSeed(CAMPAIGN_CATALOG[17]!.id)]);
 await click(page,240,548); // Chapter 6's third card is still order 18.
 const before=await boardPixels(page);await dragMove(page,WITNESSES[17]![0]!);
 expect((await boardPixels(page)).equals(before)).toBe(false);
});

// A second, independently generated real defeat reaches the same terminal UI in
// five moves. The complete retry -> victory journey retains real Canvas drags.
test('order 18 free retry after real defeat completes the collection',async({page},info)=>{
 const prefix=CAMPAIGN_CATALOG.slice(0,17).map(o=>o.id);
 await seedAchievements(page,prefix);await seed(page,{locale:'en'});await open(page);await click(page,240,412);
 await click(page,420,174);await campaignSeed(page,[2710938419,witnessSeed(CAMPAIGN_CATALOG[17]!.id)]);
 await click(page,240,548);
 await complete(page,[[0,0,3],[1,2,2],[2,3,0],[0,3,5],[2,5,3]]);
 expect((await campaign(page))?.completedOrderIds).toEqual(prefix);
 await click(page,240,553); // Existing free result retry; no ad or confirmation.
 await complete(page,WITNESSES[17]!);
 expect((await campaign(page))?.completedOrderIds).toEqual(CAMPAIGN_CATALOG.map(o=>o.id));
 await page.screenshot({path:info.outputPath('order-18-after-defeat-retry.png')});
});

test('final completed order remains freely replayable from chapter 6',async({page})=>{
 await seedAchievements(page,CAMPAIGN_CATALOG.map(o=>o.id));await seed(page,{locale:'en'});
 await open(page);await click(page,240,412);await selectOrder(page,17);
 await complete(page,WITNESSES[17]!);
 expect((await campaign(page))?.completedOrderIds).toHaveLength(18);
});

test('random opening changes on retry and reentry, while journal returns to the selected chapter',async({page},info)=>{
 await seedAchievements(page,CAMPAIGN_CATALOG.slice(0,3).map(o=>o.id));
 await seed(page,{locale:'ru'});await open(page);await click(page,240,412);await click(page,132,174);
 await campaignSeed(page,[123,456,789]);
 await click(page,240,278); // Order 04, chapter 2.
 const tray=async()=>{
  const a=await point(page,20,614),b=await point(page,460,726);
  return page.screenshot({clip:{x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y}});
 };
 const first=await tray();
 await page.screenshot({path:info.outputPath('random-order-04-first.png')});
 await click(page,130,759);await click(page,240,450);
 const retry=await tray();expect(retry.equals(first),'Retry consumes new entropy and changes the actual rendered pieces').toBe(false);
 await click(page,49,45); // No moves: direct return to chapter 2.
 await page.screenshot({path:info.outputPath('journal-retains-order-04-chapter.png')});
 await click(page,240,278); // Same location is still order 04, now with a third seed.
 expect((await tray()).equals(retry)).toBe(false);
 const boardBefore=await boardPixels(page);
 const attempt=initialAttempt(CAMPAIGN_CATALOG[3]!,789);
 let move: number[]|undefined;
 outer:for(let slot=0;slot<3;slot++)for(let r=0;r<10;r++)for(let c=0;c<10;c++){
  if(placeCampaign(attempt,slot,r,c)!==attempt){move=[slot,r,c];break outer;}
 }
 expect(move).toBeDefined();await dragMove(page,move!);
 expect((await boardPixels(page)).equals(boardBefore)).toBe(false);
 expect((await campaign(page))?.completedOrderIds).toHaveLength(3);
});

for(const locale of ['ru','en'] as const) {
 test(`all 18 ${locale} titles fit a single line at unchanged body font size, including landscape and desktop`,async({page},info)=>{
  await seedAchievements(page,CAMPAIGN_CATALOG.map(o=>o.id));await seed(page,{locale});await open(page);
  const titles=CAMPAIGN_CATALOG.map(o=>o.title[locale]);
  const widths=await page.evaluate(async titles=>{
   await document.fonts.ready;
   const context=document.createElement('canvas').getContext('2d')!;context.font='600 22px Nunito';
   return titles.map(title=>context.measureText(title).width);
  },titles);
  for(const [i,width]of widths.entries())expect(width,`${titles[i]} must fit between x=122 and card's inner right edge x=430`).toBeLessThanOrEqual(308);
  await click(page,240,412);
  for(const viewport of [{width:852,height:393},{width:1280,height:800}]){
   await page.setViewportSize(viewport);await frames(page);
   for(let chapter=1;chapter<=6;chapter++){
    await click(page,60+(chapter-1)*72,174);
    await page.screenshot({path:info.outputPath(`journal-${locale}-${viewport.width}-chapter-${chapter}.png`)});
   }
  }
 });
}

test.describe('Android journal navigation',()=>{
 test.use({userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36',hasTouch:true});
for(const locale of ['ru','en'])for(const width of [320,360,393]) {
 test(`journal single navigation, Back and Esc preserve completed orders and Classic ${locale} ${width}px`,async({page},info)=>{
  const ids=CAMPAIGN_CATALOG.map(o=>o.id);
  await seedAchievements(page,ids);await seed(page,{locale,score:71});
  await page.setViewportSize({width,height:Math.round(width*16/9)});await open(page);
  const saved=await snapshot(page);
  await click(page,240,412);
  const initial=await page.screenshot();
  // Removed controls must have no hidden interactive zone, even with all orders completed.
  for(const [x,y]of [[49,45],[154,650],[326,650]])await click(page,x!,y!);
  expect((await page.screenshot()).equals(initial)).toBe(true);
  for(let chapter=1;chapter<=6;chapter++){
   await click(page,60+(chapter-1)*72,174);
   await page.screenshot({path:info.outputPath(`journal-${locale}-${width}-chapter-${chapter}.png`)});
   expect(await page.evaluate(()=>({x:scrollX,y:scrollY,width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight})))
    .toEqual({x:0,y:0,width,height:Math.round(width*16/9)});
  }
  await click(page,240,756); // Back must return to menu, including with a finished campaign.
  await click(page,240,412); // Menu Orders opens the same selected chapter.
  await page.keyboard.press('Escape');await frames(page);
  await click(page,240,565);await drag(page,0,0,0);
  expect((await snapshot(page)).score).toBe(saved.score+1);
  expect((await campaign(page))?.completedOrderIds).toEqual(ids);
 });
}

});

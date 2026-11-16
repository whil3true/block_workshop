import SOLUTIONS from './campaign-solutions.json';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_CATALOG, CHAPTERS, isOrderUnlocked, type OrderConfig } from '../src/campaign/CampaignCatalog';
import { CampaignController as RuntimeController, initialAttempt as runtimeInitialAttempt, placeCampaign, randomCampaignTray, freshAttemptSeed, type CampaignAttempt } from '../src/campaign/CampaignSession';
import { CAMPAIGN_KEY, LEGACY_CAMPAIGN_KEY, loadCampaign, saveCampaign, validAttempt } from '../src/campaign/CampaignStore';
import { clearTargets, fragmentProgress, initialTargets, journalProgress, orderProgress } from '../src/campaign/OrderRules';
import { applyPlacement, canPlace, resolveClears, type CellState } from '../src/engine';
import { findPieceById } from '../src/pieces';
import { createModel } from '../src/model';
import { WITNESSES, COLUMN_FIRST, SIMULTANEOUS, RECOVERY_PATHS, DEFEAT_18, RANDOM_SCENARIOS, witnessSeed, recoverySeed, CONSTRUCTIVE_WITNESSES, CONSTRUCTIVE_RECOVERY_PATHS } from './campaign-witnesses';
const initialAttempt = (order: OrderConfig, seed = witnessSeed(order.id)) => runtimeInitialAttempt(order, seed);
class CampaignController extends RuntimeController {
 constructor(onChange = () => {}, canInteract = () => true) { super(onChange,canInteract,order=>witnessSeed(order.id)); }
}
const simulate = (state: CampaignAttempt, move: readonly number[]) => placeCampaign(state,move[0]!,move[1]!,move[2]!);
const step = (controller: CampaignController, move: readonly number[]) => controller.place(move[0]!,move[1]!,move[2]!);
beforeEach(()=>localStorage.clear());
const prefix = (index: number) => CAMPAIGN_CATALOG.slice(0,index).map(o=>o.id);
function replay(state: CampaignAttempt, moves: readonly (readonly number[])[]): CampaignAttempt {
 for (const move of moves) {
  const slot=move[0]!,row=move[1]!,col=move[2]!;
  expect(state.status).toBe('running');
  expect(canPlace(state.board,findPieceById(state.trayIds[slot]!)!,row,col)).toBe(true);
  const clears=resolveClears(applyPlacement(state.board,findPieceById(state.trayIds[slot]!)!,row,col));
  const expected=state.remainingTargets.filter(cell=>!clears.rowsCleared.includes(Math.floor(cell/10))&&!clears.colsCleared.includes(cell%10));
  const next=placeCampaign(state,slot,row,col);expect(next.remainingTargets).toEqual(expected);expect(next.moves).toBe(state.moves+1);state=next;
  expect(validAttempt(state)).toBe(true);
 }
 return state;
}
for (const [index,order] of CAMPAIGN_CATALOG.entries()) {
 describe(order.id,()=>{
  it('has disjoint, occupied original target fragments and no prefilled full lines',()=>{
   const targets=initialTargets(order.fragments);expect(targets.length).toBeGreaterThan(0);expect(new Set(targets).size).toBe(targets.length);
   expect(order.fragments.map(f=>f.id)).toEqual([...new Set(order.fragments.map(f=>f.id))]);
   for(const cell of targets) expect(order.board[Math.floor(cell/10)]![cell%10]).not.toBeNull();
   expect(resolveClears(order.board).rowsCleared).toEqual([]);expect(resolveClears(order.board).colsCleared).toEqual([]);
  });
  it('replays a hand-authored solution through production rules, without rewards',()=>{
   const state=replay(initialAttempt(order),WITNESSES[index]!);
   expect(state.status).toBe('succeeded');expect(state.remainingTargets).toEqual([]);expect(state.moves).toBe(WITNESSES[index]!.length);
   expect(placeCampaign(state,0,0,0)).toBe(state);
  });
  it('keeps progress only in memory and persists earned completion without changing Classic',()=>{
   const classic=createModel({rng:()=>.1});classic.place(0,0,0);
   localStorage.setItem('block-workshop:ui-locale','en');
   localStorage.setItem('block-workshop:audio-settings','{"musicVolume":0.3,"sfxVolume":0.8}');
   const unrelated=Object.fromEntries(Object.entries(localStorage));
   saveCampaign({completedOrderIds:prefix(index),active:null});
   let controller=new CampaignController();
   expect(controller.start(order.id)).toBe(true);
   for(const move of WITNESSES[index]!) {
    expect(controller.place(move[0]!,move[1]!,move[2]!)).toBe(true);
    const current=controller.active!;
    expect(validAttempt(current)).toBe(true);
    expect(loadCampaign().active).toBeNull();
   }
   expect(controller.active?.status).toBe('succeeded');
   expect(controller.completed).toContain(order.id);
   for(const [key,value] of Object.entries(unrelated))expect(localStorage.getItem(key)).toBe(value);
   controller=new CampaignController();
   expect(controller.active).toBeNull();
   expect(controller.completed).toContain(order.id);
   expect(controller.start(order.id,true)).toBe(true);
   expect(controller.active).toEqual(initialAttempt(order));
  });
  it('clearing an entirely new line earns score but no target progress',()=>{
   let state=initialAttempt(order);
   // Add ordinary blocks to an otherwise empty row. None is a target.
   const board=state.board.map(r=>[...r]);const row=board.findIndex((_,r)=>!state.remainingTargets.some(cell=>Math.floor(cell/10)===r));
   for(let c=0;c<10;c++)board[row]![c]='single';board[row]![5]=null;
   state={...state,board,trayIds:['single','single','single']};
   const next=placeCampaign(state,0,row,5);
   expect(next.score).toBeGreaterThan(state.score);expect(next.remainingTargets).toEqual(state.remainingTargets);expect(next.status).toBe('running');
  });
  it('does not restore a defeated attempt from storage; free retry starts at exact initial state',()=>{
   const initial=initialAttempt(order);
   const board:CellState[][]=Array.from({length:10},(_,r)=>Array.from({length:10},(_,c)=>(r+c)%2===0?null:'sq2'));
   for(const cell of initial.remainingTargets)board[Math.floor(cell/10)]![cell%10]=order.board[Math.floor(cell/10)]![cell%10]!;
   const address=board.flatMap((row,r)=>row.map((cell,c)=>cell===null?r*10+c:-1)).find(cell=>cell>=0)!;
   const failed=placeCampaign({...initial,board,trayIds:['single','square-3','square-3']},0,Math.floor(address/10),address%10);
   expect(failed.status).toBe('failed');
   // An older v2 record may still contain the defeated attempt; it must not resume.
   const raw={app:'block-workshop',mode:'campaign',schemaVersion:2,catalogVersion:2,targetRulesVersion:2,completedOrderIds:prefix(index),active:failed};
   localStorage.setItem(CAMPAIGN_KEY,JSON.stringify(raw));
   const controller=new CampaignController();
   expect(controller.active).toBeNull();
   expect(controller.start(order.id)).toBe(true);
   expect(controller.active).toEqual(initial);
   expect(controller.start(order.id,true)).toBe(true);
   expect(controller.active).toEqual(initial);
  });
  it('has a verified successful recovery after a genuine misplaced piece',()=>{
   const initial=initialAttempt(order,recoverySeed(order.id)), first=RECOVERY_PATHS[index]![0];
   const mistaken=replay(initial,[first]);expect(mistaken.remainingTargets).toEqual(initial.remainingTargets);
   expect(replay(mistaken,RECOVERY_PATHS[index]!.slice(1)).status).toBe('succeeded');
  });
 });
}
it('row-first, column-first and simultaneous clears all finish the same second order',()=>{
 for(const moves of [WITNESSES[1],COLUMN_FIRST,SIMULTANEOUS]) {
  const state=replay(initialAttempt(CAMPAIGN_CATALOG[1]!),moves);expect(state.status).toBe('succeeded');
 }
 const rowFirst=replay(initialAttempt(CAMPAIGN_CATALOG[1]!),WITNESSES[1].slice(0,1));
 const colFirst=replay(initialAttempt(CAMPAIGN_CATALOG[1]!),COLUMN_FIRST.slice(0,2));
 expect(fragmentProgress(CAMPAIGN_CATALOG[1]!.fragments[0]!,rowFirst.remainingTargets).remaining).toBe(0);
 expect(fragmentProgress(CAMPAIGN_CATALOG[1]!.fragments[1]!,colFirst.remainingTargets).remaining).toBe(0);
});
it('unions row/column intersections once and advances multiple fragments independently',()=>{
 expect(clearTargets([0,1,10,11,22],{rowsCleared:[0],colsCleared:[0]})).toEqual([11,22]);
 const initial=initialAttempt(CAMPAIGN_CATALOG[1]!), next=replay(initial,SIMULTANEOUS);
 expect(orderProgress(CAMPAIGN_CATALOG[1]!.fragments,next.remainingTargets)).toEqual({total:8,remaining:0,removed:8});
});
it('partial fragment progress stays in the current attempt; replacements never reactivate targets',()=>{
 const order=CAMPAIGN_CATALOG[2]!, initial=initialAttempt(order);
 const partial=replay(initial,[WITNESSES[2][0]]);
 expect(fragmentProgress(order.fragments[0]!,partial.remainingTargets)).toEqual({total:4,removed:2,remaining:2});
 saveCampaign({active:partial,completedOrderIds:prefix(2)});expect(loadCampaign().active).toBeNull();
 // Put ordinary replacement tiles at (4,0),(4,1), preserving the other two target cells.
 let next=placeCampaign({...partial,trayIds:['domino-h','single','single']},0,4,0);
 expect(next.board[4]![0]).not.toBeNull();expect(next.remainingTargets).toEqual(partial.remainingTargets);
 expect(fragmentProgress(order.fragments[0]!,next.remainingTargets).removed).toBe(2);
 const board=next.board.map(r=>[...r]);for(let c=2;c<9;c++)board[4]![c]='single';
 next=placeCampaign({...next,board},1,4,9);
 expect(next.remainingTargets).toEqual(partial.remainingTargets);expect(next.status).toBe('running');
});
it('rejects invalid/occupied drops and noninteger coordinates without mutation',()=>{
 const state=initialAttempt(CAMPAIGN_CATALOG[0]!);
 for(const move of [[0,8,0],[0,0,9],[4,0,0],[0,.5,1],[0,-1,1],[-1,0,0]] as const)expect(placeCampaign(state,move[0],move[1],move[2])).toBe(state);
});
it('victory on the last tray piece does not consume another deal',()=>{
 const state=replay(initialAttempt(CAMPAIGN_CATALOG[0]!),WITNESSES[0]);expect(state.trayIds).toEqual([null,null,null]);expect(state.nextTrayIndex).toBe(1);
});
it('unlocks only released orders; a completed replay preserves completion',()=>{
 const controller=new CampaignController();expect(controller.start(CAMPAIGN_CATALOG[2]!.id)).toBe(false);controller.start(CAMPAIGN_CATALOG[0]!.id);
 for(const move of WITNESSES[0])controller.place(move[0]!,move[1]!,move[2]!);
 expect(isOrderUnlocked(CAMPAIGN_CATALOG[1]!.id,controller.completed)).toBe(true);controller.start(CAMPAIGN_CATALOG[0]!.id,true);expect(controller.completed).toHaveLength(1);
 expect(CHAPTERS).toHaveLength(3);for(const chapter of CHAPTERS)expect(chapter.orderIds).toHaveLength(6);
});
it('keeps deterministic fallback RNG and tray cursor within a single attempt',()=>{
 let state=initialAttempt(CAMPAIGN_CATALOG[0]!), fallbackReached=false;
 for(let i=0;i<65 && state.status==='running';i++) {
  let chosen: CampaignAttempt | null=null;
  outer:for(let s=0;s<3;s++)for(let r=0;r<10;r++)for(let c=0;c<10;c++) {
   const next=placeCampaign(state,s,r,c);if(next!==state && next.remainingTargets.length===4 && next.status==='running'){chosen=next;break outer;}
  }
  if(!chosen)break;state=chosen;saveCampaign({active:state,completedOrderIds:[]});expect(loadCampaign().active).toBeNull();
  if(state.nextTrayIndex>(CAMPAIGN_CATALOG[0]! as Extract<OrderConfig,{deal:'fixed'}>).trays.length)fallbackReached=true;
 }
 expect(fallbackReached).toBe(true);const restored=state;
 for(let s=0;s<3;s++)for(let r=0;r<10;r++)for(let c=0;c<10;c++)expect(placeCampaign(restored,s,r,c)).toEqual(placeCampaign(state,s,r,c));
});
for(const field of ['board','trayIds','rngState','remainingTargets','contentVersion','targetRulesVersion','nextTrayIndex','status','moves'] as const)it(`ignores old persisted ${field} attempts, preserving completed orders and other stores`,()=>{
 const existing=initialAttempt(CAMPAIGN_CATALOG[1]!);
 saveCampaign({active:existing,completedOrderIds:prefix(1)});
 const raw=JSON.parse(localStorage.getItem(CAMPAIGN_KEY)!);
 raw.active={...existing,[field]:'invalid'};
 localStorage.setItem(CAMPAIGN_KEY,JSON.stringify(raw));
 localStorage.setItem('block-workshop:bestScore','999');
 const loaded=loadCampaign();
 expect(loaded.active).toBeNull();
 expect(loaded.notice).toBeNull();
 expect(loaded.completedOrderIds).toEqual(prefix(1));
 expect(localStorage.getItem('block-workshop:bestScore')).toBe('999');
});
for(const mask of [[80,80],[999],[],[0],[80,81,82]])it(`rejects invalid initial mask ${JSON.stringify(mask)}`,()=>{
 expect(validAttempt({...initialAttempt(CAMPAIGN_CATALOG[0]!),remainingTargets:mask})).toBe(false);
});
it('never interprets old stage/count as target progress; the reset notice survives until acknowledged',()=>{
 localStorage.setItem(LEGACY_CAMPAIGN_KEY,JSON.stringify({schemaVersion:1,completedOrderIds:prefix(3),active:{stage:2,count:1}}));
 localStorage.setItem('block-workshop:lastGame','classic');localStorage.setItem('block-workshop:ui-locale','ru');
 let c=new CampaignController();expect(c.completed).toEqual([]);expect(c.active).toBeNull();expect(c.notice).toBe('updated');
 c=new CampaignController();expect(c.notice).toBe('updated');c.acknowledgeNotice();expect(new CampaignController().notice).toBeNull();
 expect(localStorage.getItem('block-workshop:lastGame')).toBe('classic');expect(localStorage.getItem('block-workshop:ui-locale')).toBe('ru');
 expect(validAttempt({...initialAttempt(CAMPAIGN_CATALOG[0]!),stage:0,count:0})).toBe(false);
});
it('recovers malformed JSON, incompatible envelopes and unavailable storage',()=>{
 for(const raw of ['{','null','{"schemaVersion":1}']){localStorage.setItem(CAMPAIGN_KEY,raw);expect(loadCampaign()).toMatchObject({active:null,notice:'recovered'});}
 const get=vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('denied');});expect(loadCampaign().active).toBeNull();get.mockRestore();
 const set=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('full');});expect(()=>saveCampaign({active:null,completedOrderIds:[]})).not.toThrow();set.mockRestore();
});
it('pauses campaign placement with the shared gate',()=>{
 let paused=false;const c=new CampaignController(()=>{},()=>!paused);c.start(CAMPAIGN_CATALOG[0]!.id);paused=true;expect(c.place(0,8,4)).toBe(false);paused=false;expect(c.place(0,8,4)).toBe(true);
});

it('every entry of every order starts fresh; leaving discards transient state but preserves completions',()=>{
 for(const [index,order] of CAMPAIGN_CATALOG.entries()){
  localStorage.clear();
  saveCampaign({active:null,completedOrderIds:prefix(index)});
  let c=new CampaignController();
  expect(c.start(order.id)).toBe(true);
  const partial=simulate(c.active!,WITNESSES[index]![0]!);
  expect(partial.status).toBe('running');
  expect(step(c,WITNESSES[index]![0]!)).toBe(true);
  expect(c.active).toEqual(partial);
  expect(loadCampaign().active).toBeNull();
  c.abandon();
  expect(c.active).toBeNull();
  expect(c.completed).toEqual(prefix(index));
  expect(c.start(order.id)).toBe(true);
  expect(c.active).toEqual(initialAttempt(order));
  step(c,WITNESSES[index]![0]!);
  expect(c.start(order.id)).toBe(true); // Re-enter without visiting another order.
  expect(c.active).toEqual(initialAttempt(order));
  for(const move of WITNESSES[index]!)expect(step(c,move)).toBe(true);
  expect(c.active?.status).toBe('succeeded');
  expect(c.completed).toContain(order.id);
  expect(loadCampaign().active).toBeNull();
  c.abandon();
  c=new CampaignController();
  expect(c.completed).toContain(order.id);
  expect(c.start(order.id)).toBe(true);
  expect(c.active).toEqual(initialAttempt(order));
 }
});
it('completed journal progress survives replay and abandonment while live progress is not durable',()=>{
 const order=CAMPAIGN_CATALOG[0]!;
 const c=new CampaignController();
 expect(c.start(order.id)).toBe(true);
 expect(step(c,WITNESSES[0]![0]!)).toBe(true);
 expect(loadCampaign().active).toBeNull();
 c.abandon();
 expect(journalProgress(order.fragments,false,null)).toBeNull();
 expect(c.start(order.id)).toBe(true);
 for(const move of WITNESSES[0]!)step(c,move);
 expect(c.completed).toContain(order.id);
 expect(journalProgress(order.fragments,true,null)).toEqual({total:4,removed:4,remaining:0});
 c.start(order.id);
 step(c,WITNESSES[0]![0]!);
 c.abandon();
 expect(new CampaignController().completed).toContain(order.id);
 expect(journalProgress(order.fragments,true,null)).toEqual({total:4,removed:4,remaining:0});
});
it('legacy v2 active snapshot is ignored without migration alert or progress loss',()=>{
 const order=CAMPAIGN_CATALOG[0]!, partial=simulate(initialAttempt(order),WITNESSES[0]![0]!);
 localStorage.setItem(CAMPAIGN_KEY,JSON.stringify({app:'block-workshop',mode:'campaign',schemaVersion:2,catalogVersion:2,targetRulesVersion:2,completedOrderIds:[order.id],active:partial,notice:null}));
 const c=new CampaignController();
 expect(c.active).toBeNull();
 expect(c.notice).toBeNull();
 expect(c.completed).toContain(order.id);
 expect(c.start(order.id)).toBe(true);
 expect(c.active).toEqual(initialAttempt(order));
 expect(JSON.parse(localStorage.getItem(CAMPAIGN_KEY)!).active).not.toBeTruthy();
});

it('keeps all 18 layouts and constructive proofs, with authored deals only in tutorial runtime',()=>{
 expect(CAMPAIGN_CATALOG).toHaveLength(18);
 expect(new Set(CAMPAIGN_CATALOG.map(o=>o.id)).size).toBe(18);
 expect(new Set(CAMPAIGN_CATALOG.map(o=>JSON.stringify(o.board))).size).toBe(18);
 for(const [i,o] of CAMPAIGN_CATALOG.entries()){
  expect(o.chapter).toBe(Math.floor(i/6)+1);
  expect(o.deal).toBe(i<3?'fixed':'random');
  if(o.deal==='random'){expect('trays' in o).toBe(false);expect('seed' in o).toBe(false);}
  const data=SOLUTIONS[i]!;
  const {seed,trays,solution,recovery,removedPerMove,designDifficulty,designNotes,...base}=data;
  const {deal,...runtime}=o;
  expect(o.deal==='fixed'?runtime:base).toEqual(o.deal==='fixed'?{...base,seed,trays}:runtime);
  expect(solution).toEqual(CONSTRUCTIVE_WITNESSES[i]);expect(recovery).toEqual(CONSTRUCTIVE_RECOVERY_PATHS[i]);
  expect(designDifficulty).toBeGreaterThan(0);expect(designNotes.length).toBeGreaterThan(0);
  // Replay historical proofs by explicitly supplying test-only deals; production ignores them.
  for(const path of [solution,recovery]){
   let state=initialAttempt(o);const removed:number[]=[];
   for(const m of path){
    const tray=trays[state.nextTrayIndex-1]!;
    const trayIds=state.trayIds.map((_,slot)=>state.trayIds[slot]===null?null:tray[slot]!);
    if(state.moves===0)for(let slot=0;slot<3;slot++)trayIds[slot]=tray[slot]!;
    const next=simulate({...state,trayIds},m);
    expect(next.moves).toBe(state.moves+1);removed.push(state.remainingTargets.length-next.remainingTargets.length);state=next;
   }
   expect(state.status).toBe('succeeded');if(path===solution)expect(removed).toEqual(removedPerMove);
  }
 }
});
it('preserves the shipped three-order completion prefix and unlocks 04 without a migration notice',()=>{
 localStorage.setItem(CAMPAIGN_KEY,JSON.stringify({app:'block-workshop',mode:'campaign',schemaVersion:2,catalogVersion:2,targetRulesVersion:2,completedOrderIds:prefix(3),active:null,notice:null}));
 const c=new CampaignController();expect(c.completed).toEqual(prefix(3));expect(c.notice).toBeNull();
 expect(c.start(CAMPAIGN_CATALOG[3]!.id)).toBe(true);expect(c.start(CAMPAIGN_CATALOG[4]!.id)).toBe(false);
 for(const m of WITNESSES[3]!)expect(step(c,m)).toBe(true);
 expect(new CampaignController().completed).toEqual(prefix(4));
});
it('unlocks exactly one next order at every prefix, including both chapter boundaries and final replay',()=>{
 for(let count=0;count<=18;count++)for(const [index,o] of CAMPAIGN_CATALOG.entries())expect(isOrderUnlocked(o.id,prefix(count))).toBe(index<=count);
 const c=new CampaignController();
 for(const [index,o] of CAMPAIGN_CATALOG.entries()){
  expect(c.start(o.id)).toBe(true);for(const m of WITNESSES[index]!)expect(step(c,m)).toBe(true);
  expect(c.completed).toEqual(prefix(index+1));
  expect(CHAPTERS[o.chapter-1]!.orderIds.filter(id=>c.completed.includes(id))).toHaveLength(index%6+1);
 }
 expect(c.start(CAMPAIGN_CATALOG[17]!.id,true)).toBe(true);for(const m of WITNESSES[17]!)step(c,m);
 expect(c.completed).toEqual(prefix(18));expect(loadCampaign().completedOrderIds).toEqual(prefix(18));
});

it('can genuinely lose random order 18, preserve completions, and retry for free',()=>{
 saveCampaign({completedOrderIds:prefix(17),active:null});
 const seeds=[17,witnessSeed(CAMPAIGN_CATALOG[17]!.id)];
 const c=new RuntimeController(()=>{},()=>true,()=>seeds.shift()!);
 expect(c.start(CAMPAIGN_CATALOG[17]!.id)).toBe(true);
 for(const m of DEFEAT_18)expect(step(c,m)).toBe(true);
 expect(c.active?.status).toBe('failed');expect(validAttempt(c.active)).toBe(true);
 expect(c.completed).toEqual(prefix(17));expect(loadCampaign().active).toBeNull();
 expect(c.start(CAMPAIGN_CATALOG[17]!.id,true)).toBe(true);
 for(const m of WITNESSES[17]!)expect(step(c,m)).toBe(true);
 expect(c.active?.status).toBe('succeeded');expect(c.completed).toEqual(prefix(18));
});

it('draws fresh entropy on entry and retry, but never for tutorials or a locked order',()=>{
 saveCampaign({active:null,completedOrderIds:prefix(3)});
 const seeds=vi.fn().mockReturnValueOnce(123).mockReturnValueOnce(456).mockReturnValueOnce(789);
 const c=new RuntimeController(()=>{},()=>true,seeds), o=CAMPAIGN_CATALOG[3]!;
 c.start(CAMPAIGN_CATALOG[0]!.id);expect(seeds).not.toHaveBeenCalled();
 expect(c.start(CAMPAIGN_CATALOG[4]!.id)).toBe(false);expect(seeds).not.toHaveBeenCalled();
 c.start(o.id);const first=c.active!;expect(first).toEqual(runtimeInitialAttempt(o,123));
 c.start(o.id,true);expect(c.active).toEqual(runtimeInitialAttempt(o,456));expect(c.active?.trayIds).not.toEqual(first.trayIds);
 c.abandon();c.start(o.id);expect(c.active).toEqual(runtimeInitialAttempt(o,789));expect(seeds).toHaveBeenCalledTimes(3);
 expect(c.completed).toEqual(prefix(3));expect(loadCampaign().completedOrderIds).toEqual(prefix(3));
});
it('production entropy is sampled per attempt, and explicit invalid seeds cannot lock xorshift at zero',()=>{
 const entropy=vi.spyOn(globalThis.crypto,'getRandomValues').mockImplementationOnce(a=>{(a as Uint32Array)[0]=123;return a;}).mockImplementationOnce(a=>{(a as Uint32Array)[0]=456;return a;});
 const o=CAMPAIGN_CATALOG[3]!;
 expect(runtimeInitialAttempt(o)).toEqual(runtimeInitialAttempt(o,123));
 expect(runtimeInitialAttempt(o)).toEqual(runtimeInitialAttempt(o,456));expect(entropy).toHaveBeenCalledTimes(2);entropy.mockRestore();
 for(const seed of [0,-1,NaN,Infinity,1.5,0x100000000])expect(()=>runtimeInitialAttempt(o,seed)).toThrow(RangeError);
 expect(freshAttemptSeed()).toBeGreaterThan(0);
});
it('all random orders use the seed for the first deal and every refill, independent of authored holes',()=>{
 for(const o of CAMPAIGN_CATALOG.slice(3)){
  const a=runtimeInitialAttempt(o,12345),b=runtimeInitialAttempt(o,67890);
  expect(a.trayIds).not.toEqual(b.trayIds);expect(a).toEqual(runtimeInitialAttempt(o,12345));
  expect({trayIds:a.trayIds,rngState:a.rngState}).toEqual(randomCampaignTray(12345));
  expect(validAttempt(a)).toBe(true);
  let s=a;
  for(let turn=0;turn<90&&s.status==='running';turn++){
   let next:CampaignAttempt|undefined;
   outer:for(let slot=0;slot<3;slot++)for(let r=0;r<10;r++)for(let c=0;c<10;c++){
    const n=placeCampaign(s,slot,r,c);if(n!==s){next=n;break outer;}
   }
   expect(next).toBeDefined();
   if(next!.nextTrayIndex>s.nextTrayIndex)expect({trayIds:next!.trayIds,rngState:next!.rngState}).toEqual(randomCampaignTray(s.rngState));
   else expect(next!.rngState).toBe(s.rngState);
   expect(placeCampaign(s,0,0,0)).toEqual(placeCampaign(s,0,0,0));
   s=next!;expect(validAttempt(s)).toBe(true);
  }
  expect(s.status).not.toBe('running'); // This legal, deliberately naive player must terminate.
 }
});
it('survives 10000 reproducible random deals, covers all catalogue pieces and changes RNG state',()=>{
 let state=12345;const seen=new Set<string>();
 for(let i=0;i<10000;i++){
  const a=randomCampaignTray(state);expect(a).toEqual(randomCampaignTray(state));expect(a.rngState).not.toBe(state);expect(a.rngState).toBeGreaterThan(0);
  expect(a.trayIds).toHaveLength(3);for(const id of a.trayIds){expect(findPieceById(id)).toBeDefined();seen.add(id);}state=a.rngState;
 }
 expect(seen.size).toBe(37);
});
it('retains the full 18-order completion prefix through random failed replays and startup',()=>{
 saveCampaign({active:null,completedOrderIds:prefix(18)});
 const c=new RuntimeController(()=>{},()=>true,()=>17);c.start(CAMPAIGN_CATALOG[17]!.id);
 for(const m of DEFEAT_18)step(c,m);
 expect(c.active?.status).toBe('failed');c.start(CAMPAIGN_CATALOG[17]!.id,true);c.abandon();
 expect(new RuntimeController().completed).toEqual(prefix(18));expect(loadCampaign().notice).toBeNull();
});
it('replays documented seeded random outcomes, with actual wins and losses for every 04–18 layout',()=>{
 for(const scenario of RANDOM_SCENARIOS){
  const o=CAMPAIGN_CATALOG.find(o=>o.id===scenario.id)!;
  expect(replay(runtimeInitialAttempt(o,scenario.witness.seed),scenario.witness.moves).status).toBe('succeeded');
  expect(replay(runtimeInitialAttempt(o,scenario.defeat.seed),scenario.defeat.moves).status).toBe('failed');
 }
});

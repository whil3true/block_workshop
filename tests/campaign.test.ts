import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_CATALOG, CHAPTERS, isOrderUnlocked } from '../src/campaign/CampaignCatalog';
import { CampaignController, initialAttempt, placeCampaign, type CampaignAttempt } from '../src/campaign/CampaignSession';
import { CAMPAIGN_KEY, LEGACY_CAMPAIGN_KEY, loadCampaign, saveCampaign, validAttempt } from '../src/campaign/CampaignStore';
import { clearTargets, fragmentProgress, initialTargets, orderProgress } from '../src/campaign/OrderRules';
import { canPlace, resolveClears, type CellState } from '../src/engine';
import { findPieceById } from '../src/pieces';
import { createModel } from '../src/model';
import { WITNESSES, COLUMN_FIRST, SIMULTANEOUS, RECOVERY_PATHS } from './campaign-witnesses';
beforeEach(()=>localStorage.clear());
const prefix = (index: number) => CAMPAIGN_CATALOG.slice(0,index).map(o=>o.id);
function replay(state: CampaignAttempt, moves: readonly (readonly [number,number,number])[]): CampaignAttempt {
 for (const [slot,row,col] of moves) {
  expect(state.status).toBe('running');
  expect(canPlace(state.board,findPieceById(state.trayIds[slot]!)!,row,col)).toBe(true);
  const next=placeCampaign(state,slot,row,col);expect(next.moves).toBe(state.moves+1);state=next;
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
  it('restores every move exactly, including partial masks and success, without touching classic or settings',()=>{
   const classic=createModel({rng:()=>.1});classic.place(0,0,0);
   localStorage.setItem('block-workshop:ui-locale','en');localStorage.setItem('block-workshop:audio-settings','{"musicVolume":0.3,"sfxVolume":0.8}');
   const unrelated=Object.fromEntries(Object.entries(localStorage));
   saveCampaign({completedOrderIds:prefix(index),active:initialAttempt(order)});let controller=new CampaignController();
   for(const move of WITNESSES[index]!) {
    expect(controller.place(move[0],move[1],move[2])).toBe(true);const before=controller.active;
    controller=new CampaignController();expect(controller.active).toEqual(before);
   }
   expect(controller.completed).toContain(order.id);
   for(const [key,value] of Object.entries(unrelated))expect(localStorage.getItem(key)).toBe(value);
   expect(controller.start(order.id,true)).toBe(true);expect(controller.active).toEqual(initialAttempt(order));
   expect(controller.completed.filter(id=>id===order.id)).toHaveLength(1);
  });
  it('clearing an entirely new line earns score but no target progress',()=>{
   let state=initialAttempt(order);
   // Add ordinary blocks to an otherwise empty row. None is a target.
   const board=state.board.map(r=>[...r]);const row=index===2?7:9;
   for(let c=0;c<10;c++)board[row]![c]='single';board[row]![5]=null;
   state={...state,board,trayIds:['single','single','single']};
   const next=placeCampaign(state,0,row,5);
   expect(next.score).toBeGreaterThan(state.score);expect(next.remainingTargets).toEqual(state.remainingTargets);expect(next.status).toBe('running');
  });
  it('persists actual blocked-tray defeat and retries with the exact free initial state',()=>{
   const initial=initialAttempt(order);
   const board:CellState[][]=Array.from({length:10},(_,r)=>Array.from({length:10},(_,c)=>(r+c)%2===0?null:'sq2'));
   for(const cell of initial.remainingTargets)board[Math.floor(cell/10)]![cell%10]=order.board[Math.floor(cell/10)]![cell%10]!;
   // No completed row/column; isolated empty cell and two impossible 3x3 squares.
   const result=placeCampaign({...initial,board,trayIds:['single','square-3','square-3']},0,9,3);
   expect(result.moves).toBe(1);expect(result.status).toBe('failed');
   saveCampaign({active:result,completedOrderIds:prefix(index)});const controller=new CampaignController();
   expect(controller.active).toEqual(result);expect(controller.start(order.id,true)).toBe(true);expect(controller.active).toEqual(initial);
  });
  it('has a verified successful recovery after a genuine misplaced piece',()=>{
   const initial=initialAttempt(order), first=RECOVERY_PATHS[index]![0];
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
it('partial fragment progress persists; refilling and clearing former target coordinates never reactivates them',()=>{
 const order=CAMPAIGN_CATALOG[2]!, initial=initialAttempt(order);
 const partial=replay(initial,[WITNESSES[2][0]]);
 expect(fragmentProgress(order.fragments[0]!,partial.remainingTargets)).toEqual({total:4,removed:2,remaining:2});
 saveCampaign({active:partial,completedOrderIds:prefix(2)});expect(loadCampaign().active).toEqual(partial);
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
 for(const move of WITNESSES[0])controller.place(move[0],move[1],move[2]);
 expect(isOrderUnlocked(CAMPAIGN_CATALOG[1]!.id,controller.completed)).toBe(true);controller.start(CAMPAIGN_CATALOG[0]!.id,true);expect(controller.completed).toHaveLength(1);
 expect(CHAPTERS).toHaveLength(3);expect(CHAPTERS[1].orderIds).toHaveLength(0);expect(CHAPTERS[2].orderIds).toHaveLength(0);
});
it('restores deterministic fallback RNG and tray cursor beyond fixed deals',()=>{
 let state=initialAttempt(CAMPAIGN_CATALOG[0]!), fallbackReached=false;
 for(let i=0;i<65 && state.status==='running';i++) {
  let chosen: CampaignAttempt | null=null;
  outer:for(let s=0;s<3;s++)for(let r=0;r<10;r++)for(let c=0;c<10;c++) {
   const next=placeCampaign(state,s,r,c);if(next!==state && next.remainingTargets.length===4 && next.status==='running'){chosen=next;break outer;}
  }
  if(!chosen)break;state=chosen;saveCampaign({active:state,completedOrderIds:[]});expect(loadCampaign().active).toEqual(state);
  if(state.nextTrayIndex>CAMPAIGN_CATALOG[0]!.trays.length)fallbackReached=true;
 }
 expect(fallbackReached).toBe(true);const restored=loadCampaign().active!;
 for(let s=0;s<3;s++)for(let r=0;r<10;r++)for(let c=0;c<10;c++)expect(placeCampaign(restored,s,r,c)).toEqual(placeCampaign(state,s,r,c));
});
for(const field of ['board','trayIds','rngState','remainingTargets','contentVersion','targetRulesVersion','nextTrayIndex','status','moves'] as const)it(`rejects damaged ${field}, retaining completed orders and other stores`,()=>{
 saveCampaign({active:initialAttempt(CAMPAIGN_CATALOG[1]!),completedOrderIds:prefix(1)});
 const raw=JSON.parse(localStorage.getItem(CAMPAIGN_KEY)!);raw.active[field]='invalid';localStorage.setItem(CAMPAIGN_KEY,JSON.stringify(raw));localStorage.setItem('block-workshop:bestScore','999');
 const loaded=loadCampaign();expect(loaded.active).toBeNull();expect(loaded.notice).toBe('recovered');expect(loaded.completedOrderIds).toEqual(prefix(1));expect(localStorage.getItem('block-workshop:bestScore')).toBe('999');
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

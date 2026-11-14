import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_CATALOG, CHAPTERS, isOrderUnlocked } from '../src/campaign/CampaignCatalog';
import { CampaignController, initialAttempt, placeCampaign } from '../src/campaign/CampaignSession';
import { CAMPAIGN_KEY, loadCampaign, saveCampaign } from '../src/campaign/CampaignStore';
import { advanceOrder } from '../src/campaign/OrderRules';
import { canPlace, hasAnyLegalPlacement, resolveClears } from '../src/engine';
import { findPieceById } from '../src/pieces';
import { createModel } from '../src/model';
import { WITNESSES } from './campaign-witnesses';
beforeEach(()=>localStorage.clear());
for (const [index,order] of CAMPAIGN_CATALOG.entries()) {
 describe(order.id,()=>{
  it('replays a full solution through production rules, without rewards',()=>{
   let state=initialAttempt(order);
   expect(resolveClears(state.board).rowsCleared).toEqual([]);expect(resolveClears(state.board).colsCleared).toEqual([]);
   for(const [slot,row,col] of WITNESSES[index]!) {
    expect(state.status).toBe('running');expect(canPlace(state.board,findPieceById(state.trayIds[slot]!)!,row,col)).toBe(true);
    state=placeCampaign(state,slot,row,col);
   }
   expect(state.status).toBe('succeeded');expect(state.stage).toBe(order.operations.length);
   expect(state.moves).toBe(WITNESSES[index]!.length);
   expect(placeCampaign(state,0,0,0)).toBe(state);
  });
  it('has room for a mistaken placement and a legal next move',()=>{
   const initial=initialAttempt(order),next=placeCampaign(initial,0,0,index === 1 ? 4 : 0);
   expect(next.moves).toBe(1);expect(next.status).toBe('running');expect(next.stage).toBe(0);
   expect(hasAnyLegalPlacement(next.board,next.trayIds.map(id=>id ? findPieceById(id)! : null))).toBe(true);
  });
  it('restores every partial-tray step exactly, including completion, without touching classic',()=>{
   const classic=createModel({rng:()=>.1});classic.place(0,0,0);const classicRaw=localStorage.getItem('block-workshop:lastGame');
   saveCampaign({completedOrderIds:CAMPAIGN_CATALOG.slice(0,index).map(o=>o.id),active:initialAttempt(order)});
   let controller=new CampaignController();
   for(const move of WITNESSES[index]!) {
    expect(controller.place(move[0],move[1],move[2])).toBe(true);
    const before=controller.active;controller=new CampaignController();expect(controller.active).toEqual(before);
   }
   expect(controller.completed).toContain(order.id);expect(controller.completed.filter(id=>id===order.id)).toHaveLength(1);
   expect(localStorage.getItem('block-workshop:lastGame')).toBe(classicRaw);
  });
 });
}
it('one simultaneous row/column clear advances only one stage',()=>{
 expect(advanceOrder([{kind:'lines',axis:'row',count:1},{kind:'lines',axis:'column',count:1}],{stage:0,count:0},{rowsCleared:[2],colsCleared:[4]})).toEqual({stage:1,count:0});
});
it('supports accumulated lines, addresses and intersections',()=>{
 expect(advanceOrder([{kind:'lines',axis:'any',count:3}],{stage:0,count:1},{rowsCleared:[0],colsCleared:[]})).toEqual({stage:0,count:2});
 expect(advanceOrder([{kind:'targetLine',axis:'column',index:6}],{stage:0,count:0},{rowsCleared:[6],colsCleared:[5]})).toEqual({stage:0,count:0});
 expect(advanceOrder([{kind:'crossClear'}],{stage:0,count:0},{rowsCleared:[0],colsCleared:[0]})).toEqual({stage:1,count:0});
});
it('wrong axis does not complete the first stage of the second order',()=>{
 const initial=initialAttempt(CAMPAIGN_CATALOG[1]!);const next=placeCampaign(initial,1,4,2);
 expect(next.stage).toBe(0);expect(next.moves).toBe(1);expect(next.status).toBe('running');
});
it('rejects invalid/occupied drops and noninteger coordinates without mutation',()=>{
 const state=initialAttempt(CAMPAIGN_CATALOG[0]!);
 for(const move of [[0,8,0],[0,0,9],[4,0,0],[0,.5,1],[0,-1,1]] as const) expect(placeCampaign(state,move[0],move[1],move[2])).toBe(state);
});
it('victory has priority when the last piece consumes the tray',()=>{
 let state=initialAttempt(CAMPAIGN_CATALOG[0]!);for(const move of WITNESSES[0])state=placeCampaign(state,move[0],move[1],move[2]);
 expect(state.trayIds).toEqual([null,null,null]);expect(state.nextTrayIndex).toBe(1);expect(state.status).toBe('succeeded');
});
it('detects an actual blocked tray after a valid nonwinning placement',()=>{
 const initial=initialAttempt(CAMPAIGN_CATALOG[0]!);
 const board=Array.from({length:10},(_,r)=>Array.from({length:10},(_,c)=>(r+c)%2 === 0 ? null : 'sq2' as const));
 const result=placeCampaign({...initial,board,trayIds:['single','square-3','square-3']},0,0,0);
 expect(result.status).toBe('failed');saveCampaign({active:result,completedOrderIds:[]});expect(loadCampaign().active).toEqual(result);
});
it('replays and unlocks sequentially; failed and completed attempts retry with the exact board',()=>{
 const c=new CampaignController();expect(c.start(CAMPAIGN_CATALOG[2]!.id)).toBe(false);expect(c.start(CAMPAIGN_CATALOG[0]!.id)).toBe(true);
 for(const move of WITNESSES[0])c.place(move[0],move[1],move[2]);
 expect(isOrderUnlocked(CAMPAIGN_CATALOG[1]!.id,c.completed)).toBe(true);c.start(CAMPAIGN_CATALOG[0]!.id,true);
 expect(c.active).toEqual(initialAttempt(CAMPAIGN_CATALOG[0]!));expect(c.completed).toHaveLength(1);
 expect(CHAPTERS).toHaveLength(3);expect(CHAPTERS[1].orderIds).toHaveLength(0);expect(CHAPTERS[2].orderIds).toHaveLength(0);
});
it('preserves deterministic fallback RNG and tray cursor across reload beyond the fixed prefix',()=>{
 let state=initialAttempt(CAMPAIGN_CATALOG[0]!);
 // A long legal, deliberately non-clearing trace exercises the fallback; restart comparison at every step.
 let fallbackReached=false;
 for(let i=0;i<65 && state.status==='running';i++) {
  let chosen: typeof state | null=null;
  outer:for(let s=0;s<3;s++)for(let r=0;r<10;r++)for(let c=0;c<10;c++) {
   const next=placeCampaign(state,s,r,c);if(next!==state && next.stage===0 && next.status==='running'){chosen=next;break outer;}
  }
  if(!chosen)break;state=chosen;
  saveCampaign({active:state,completedOrderIds:[]});expect(loadCampaign().active).toEqual(state);
  if(state.nextTrayIndex>CAMPAIGN_CATALOG[0]!.trays.length)fallbackReached=true;
 }
 expect(fallbackReached).toBe(true);
 const restored=loadCampaign().active!;
 for(let s=0;s<3;s++)for(let r=0;r<10;r++)for(let c=0;c<10;c++)expect(placeCampaign(restored,s,r,c)).toEqual(placeCampaign(state,s,r,c));
});
for(const field of ['board','trayIds','rngState','stage','contentVersion','nextTrayIndex','status','count','moves'] as const) {
 it(`discards damaged ${field} while retaining completed orders and unrelated stores`,()=>{
  const initial=initialAttempt(CAMPAIGN_CATALOG[1]!);
  saveCampaign({active:initial,completedOrderIds:[CAMPAIGN_CATALOG[0]!.id]});
  const raw=JSON.parse(localStorage.getItem(CAMPAIGN_KEY)!);raw.active[field]='invalid';localStorage.setItem(CAMPAIGN_KEY,JSON.stringify(raw));
  localStorage.setItem('block-workshop:bestScore','999');const loaded=loadCampaign();expect(loaded.active).toBeNull();expect(loaded.completedOrderIds).toHaveLength(1);expect(localStorage.getItem('block-workshop:bestScore')).toBe('999');
 });
}
it('recovers from malformed JSON and unavailable storage',()=>{
 localStorage.setItem(CAMPAIGN_KEY,'{');expect(loadCampaign().active).toBeNull();
 const get=vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('denied');});expect(loadCampaign().active).toBeNull();get.mockRestore();
 const set=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('full');});expect(()=>saveCampaign({active:null,completedOrderIds:[]})).not.toThrow();set.mockRestore();
});
it('pauses campaign placement with the shared gate',()=>{
 let paused=false;const controller=new CampaignController(()=>{},()=>!paused);controller.start(CAMPAIGN_CATALOG[0]!.id);
 paused=true;expect(controller.place(0,8,4)).toBe(false);expect(controller.active?.moves).toBe(0);paused=false;expect(controller.place(0,8,4)).toBe(true);
});

const recoveryPaths = [
 [[2,0,0],[0,8,4],[1,8,7],[2,8,9]],
 [[0,0,4],[1,7,5],[2,7,6],[0,7,7],[2,4,2],[1,0,0],[2,7,2]],
 [[1,0,0],[0,4,3],[2,4,9],[0,4,6],[1,6,0],[2,9,0],[1,6,6]],
] as const;
for(const [i,moves] of recoveryPaths.entries())it(`order ${i+1}: a real misplaced piece still has a verified recovery solution`,()=>{
 let state=initialAttempt(CAMPAIGN_CATALOG[i]!);
 for(const [slot,row,col] of moves){const next=placeCampaign(state,slot,row,col);expect(next.moves).toBe(state.moves+1);state=next;}
 expect(state.status).toBe('succeeded');
});

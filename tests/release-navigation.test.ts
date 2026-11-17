import { describe, it, expect, vi } from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class{}}}));
import { WorkshopScene, type SceneServices } from '../src/phaser/WorkshopScene';
import { CAMPAIGN_CATALOG } from '../src/campaign/CampaignCatalog';
import { PauseGate } from '../src/app/PauseGate';
import { AdFlow } from '../src/app/AdFlow';
import { WebPlatform } from '../src/platform/WebPlatform';

type SceneHarness = {
 screen:string; mode:string; ready:boolean; modal:string|null; pendingExit:string|null;
 drawCampaignResult():void; drawModal():void; navigate(screen:string):void; requestCampaignExit(screen:string):void;
 startOrder(id:string,replay?:boolean):void; commitNavigation(screen:string):void; tryClassicIntermission():boolean;
};
function harness(index=0,status='succeeded') {
 const actions=new Map<string,()=>void>(),gate=new PauseGate();
 const active={orderId:CAMPAIGN_CATALOG[index]!.id,status,moves:3};
 let finish!: (shown:boolean)=>void;
 const request=vi.fn(()=>new Promise<boolean>(r=>finish=r)),restart=vi.fn();
 const platform=new WebPlatform();
 const flow=new AdFlow({gate,platform,interstitial:{tryShow:request},cover:()=>{},afterFrame:async()=>{},restart,applyReward:()=>true});
 const services={gate,flow,platform,campaign:{active},model:{},locale:{locale:'en',t:(s:string)=>s}} as unknown as SceneServices;
 const scene=new WorkshopScene(services);
 const h=scene as unknown as SceneHarness;
 Object.assign(scene,{screen:'play',mode:'campaign',ready:true,overlay:()=>{},root:{add:()=>{}},
  add:{container:()=>{},graphics:()=>({fillStyle(){return this;},fillRoundedRect(){return this;}})},textures:{exists:()=>false},icon:()=>{},text:()=>{},surface:()=>{},
  button:(key:string,_word:string,_x:number,_y:number,action:()=>void)=>actions.set(key,action),
  closeModal:()=>{h.modal=null;gate.set('manual',false);},openModal:(m:string)=>{h.modal=m;gate.set('manual',true);},
  startOrder:vi.fn(),commitNavigation:vi.fn(),externalBlock:()=>false,
 });
 return {h,scene,actions,request,restart,gate,finish:(shown=false)=>finish(shown),active};
}
// Actual Canvas result handlers are invoked; only rendering is stubbed.
describe('campaign result transactions',()=>{
 it.each([0,2,5,8,11,14])('Next captures order %i+1 and starts it only after terminal callback',async index=>{
  const f=harness(index);f.h.drawCampaignResult();f.actions.get('next-order')!();f.actions.get('next-order')!();
  expect(f.request).toHaveBeenCalledOnce();expect(f.h.startOrder).not.toHaveBeenCalled();
  f.finish();await vi.waitFor(()=>expect(f.h.startOrder).toHaveBeenCalledWith(CAMPAIGN_CATALOG[index+1]!.id));
 });
 it.each(['succeeded','failed'])('Replay of %s captures the current order',async status=>{
  const f=harness(0,status);f.h.drawCampaignResult();f.actions.get('result-retry')!();
  expect(f.h.startOrder).not.toHaveBeenCalled();f.finish();
  await vi.waitFor(()=>expect(f.h.startOrder).toHaveBeenCalledWith(CAMPAIGN_CATALOG[0]!.id,true));
 });
 it.each(['result-journal','result-menu'])('last order: %s completes once after no-fill',async key=>{
  const f=harness(17);f.h.drawCampaignResult();expect(f.actions.has('next-order')).toBe(false);f.actions.get(key)!();
  expect(f.h.commitNavigation).not.toHaveBeenCalled();f.finish();
  await vi.waitFor(()=>expect(f.h.commitNavigation).toHaveBeenCalledWith(key==='result-journal'?'journal':'menu'));
 });
 it('Stay has no ad; confirmed exit preserves destination until ad closes',async()=>{
  const f=harness(0,'running');f.h.requestCampaignExit('menu');expect(f.h.modal).toBe('leaveOrder');expect(f.request).not.toHaveBeenCalled();
  f.h.drawModal();f.actions.get('leave-order-stay')!();expect(f.request).not.toHaveBeenCalled();expect(f.h.commitNavigation).not.toHaveBeenCalled();
  f.h.requestCampaignExit('journal');f.h.drawModal();f.actions.get('leave-order-confirm')!();
  expect(f.request).toHaveBeenCalledOnce();expect(f.h.commitNavigation).not.toHaveBeenCalled();f.finish();
  await vi.waitFor(()=>expect(f.h.commitNavigation).toHaveBeenCalledWith('journal'));
 });
 it('confirmed campaign restart waits; cancelling requests nothing',async()=>{
  const f=harness(0,'running');f.h.modal='restart';f.gate.set('manual',true);f.h.drawModal();f.actions.get('cancel')!();expect(f.request).not.toHaveBeenCalled();
  f.h.modal='restart';f.gate.set('manual',true);f.h.drawModal();f.actions.get('confirm')!();expect(f.h.startOrder).not.toHaveBeenCalled();f.finish();
  await vi.waitFor(()=>expect(f.h.startOrder).toHaveBeenCalledWith(CAMPAIGN_CATALOG[0]!.id,true));
 });
 it('menu/journal navigation has no interstitial; Classic exit uses the shared transaction',async()=>{
  const f=harness();f.h.screen='journal';f.h.navigate('menu');expect(f.request).not.toHaveBeenCalled();
  f.h.screen='play';f.h.mode='classic';f.h.navigate('menu');expect(f.request).toHaveBeenCalledOnce();f.finish();
 });
});

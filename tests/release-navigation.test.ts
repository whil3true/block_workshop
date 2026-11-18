import { describe, it, expect, vi } from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class{}}}));
import { WorkshopScene, type SceneServices } from '../src/phaser/WorkshopScene';
import { CAMPAIGN_CATALOG } from '../src/campaign/CampaignCatalog';
import { PauseGate } from '../src/app/PauseGate';
import { AdFlow } from '../src/app/AdFlow';
import { WebPlatform } from '../src/platform/WebPlatform';

type Screen = 'menu' | 'journal' | 'play';
type SceneHarness = {
 screen:Screen; mode:string; ready:boolean; modal:string|null; pendingExit:string|null;
 draw():void; drawSplash():void; overlay():void;
 drawCampaignResult():void; drawModal():void; navigate(screen:string):void; requestCampaignExit(screen:string):void;
 startOrder(id:string,replay?:boolean):void; commitNavigation(screen:string):void; tryClassicIntermission():boolean;
};
function harness(index=0,status='succeeded',afterFrame=async()=>{}) {
 const actions=new Map<string,()=>void>(),gate=new PauseGate();
 const active={orderId:CAMPAIGN_CATALOG[index]!.id,status,moves:3};
 let open: (()=>void) | undefined, finish!: (shown:boolean)=>void, fail!: (error:Error)=>void;
 const request=vi.fn((onOpen?:()=>void)=>new Promise<boolean>((resolve,reject)=>{
  open=onOpen;finish=resolve;fail=reject;
 })),restart=vi.fn();
 const platform=new WebPlatform();
 const flow=new AdFlow({gate,platform,interstitial:{tryShow:request},cover:visible=>scene.setCover(visible),afterFrame,restart,applyReward:()=>true});
 const services={gate,flow,platform,campaign:{active,abandon:vi.fn()},model:{session:1,gameOver:false},
  interstitial:{shownRevision:0},locale:{locale:'en',t:(s:string)=>s}} as unknown as SceneServices;
 const scene=new WorkshopScene(services);
 const h=scene as unknown as SceneHarness;
 Object.assign(scene,{screen:'play',mode:'campaign',ready:true,overlay:vi.fn(),root:{add:()=>{},removeAll:()=>{}},
  effects:{removeAll:()=>{},setVisible:()=>{}},drawSplash:vi.fn(),drawMenu:vi.fn(),drawJournal:vi.fn(),drawPlay:vi.fn(),
  add:{container:()=>{},graphics:()=>({fillStyle(){return this;},fillRoundedRect(){return this;}})},textures:{exists:()=>false},icon:()=>{},text:()=>{},surface:()=>{},
  button:(key:string,_word:string,_x:number,_y:number,action:()=>void)=>actions.set(key,action),
  closeModal:()=>{h.modal=null;gate.set('manual',false);},openModal:(m:string)=>{h.modal=m;gate.set('manual',true);},
  startOrder:vi.fn(),
 });
 vi.spyOn(h,'commitNavigation');
 return {h,scene,actions,request,restart,gate,flow,open:()=>open?.(),finish:(shown=false)=>finish(shown),
  fail:()=>fail(new Error('SDK error')),active};
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

describe.each([
 { key:'classic-exit', index:0, screen:'menu' },
 { key:'next-order', index:0, screen:'play' },
 { key:'result-journal', index:17, screen:'journal' },
 { key:'result-menu', index:17, screen:'menu' },
] as const)('$key during a navigation transaction',({key,index,screen})=>{
 it.each(['no-fill','error','opened'] as const)('%s keeps the input lock and only covers an opened ad',async outcome=>{
  let releaseFrame!:()=>void;
  const frame=new Promise<void>(resolve=>releaseFrame=resolve),afterFrame=vi.fn(()=>frame);
  const f=harness(index,'succeeded',afterFrame);
  f.h.drawCampaignResult();
  vi.mocked(f.h.overlay).mockClear();
  if(key==='classic-exit')f.h.mode='classic';
  const action=key==='classic-exit'?()=>f.h.navigate('menu'):f.actions.get(key)!;
  const destination=key==='next-order'?f.h.startOrder:f.h.commitNavigation;
  const expectUncovered=()=>{
   expect(f.h.drawSplash).not.toHaveBeenCalled();
   expect(f.h.overlay).not.toHaveBeenCalled();
  };

  action();action();f.h.draw();
  expect(f.gate.has('transition')).toBe(true);
  expect(f.request).toHaveBeenCalledOnce();
  expect(destination).not.toHaveBeenCalled();
  expectUncovered();

  if(outcome==='opened') {
   f.open();f.h.draw();
   expect(f.gate.has('ad')).toBe(true);
   expect(f.h.overlay).toHaveBeenCalledOnce();
   f.finish(true);
  } else if(outcome==='error')f.fail();
  else f.finish();
  await vi.waitFor(()=>expect(afterFrame).toHaveBeenCalledOnce());
  expect(f.h.screen).toBe(screen);
  expect(f.gate.has('transition')).toBe(true);
  action();f.h.draw();
  expect(f.request).toHaveBeenCalledOnce();
  expect(destination).toHaveBeenCalledOnce();
  if(outcome==='opened') {
   expect(f.gate.has('ad')).toBe(true);
   if(screen==='menu')expect(f.h.drawSplash).toHaveBeenCalledOnce();
   else expect(f.h.overlay).toHaveBeenCalledTimes(2);
  } else expectUncovered();

  releaseFrame();
  await vi.waitFor(()=>expect(f.flow.busy).toBe(false));
  expect(f.gate.has('ad')).toBe(false);
  expect(f.gate.has('transition')).toBe(false);
  vi.mocked(f.h.drawSplash).mockClear();vi.mocked(f.h.overlay).mockClear();
  f.h.draw();expectUncovered();
 });
});

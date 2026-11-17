import { it, expect, vi } from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class{}}}));
import { WorkshopScene, type SceneServices } from '../src/phaser/WorkshopScene';
import { PauseGate, type PauseReason } from '../src/app/PauseGate';
type Internals = {screen:string;mode:string;modal:string|null;drag:unknown;syncClassicClock():void;tryClassicIntermission():boolean;update(time:number,delta:number):void};
function fixture(){
 let now=0;const spy=vi.spyOn(performance,'now').mockImplementation(()=>now);
 const gate=new PauseGate(),model={session:1,gameOver:false};
 const ads={shownRevision:0,eligible:true},flow={busy:false,intermission:vi.fn(async()=>false)};
 const scene=new WorkshopScene({gate,model,interstitial:ads,flow,campaign:{active:{status:'running'}}} as unknown as SceneServices);
 Object.assign(scene,{ready:true,screen:'play',mode:'classic',dirty:false,effects:{removeAll:vi.fn()}});
 const h=scene as unknown as Internals;
 h.syncClassicClock();
 return {h,gate,model,ads,flow,at:(ms:number)=>{now=ms;},restore:()=>spy.mockRestore()};
}
it.each(['menu','journal','splash','campaign','defeat','modal','busy', 'sdk','browser','focus','ad','transition','input','manual'] as const)('scene excludes %s from active advertising time',state=>{
 const f=fixture();
 const excluded=state==='menu'||state==='journal'||state==='splash';
 if(excluded)f.h.screen=state;
 else if(state==='campaign')f.h.mode='campaign';
 else if(state==='defeat')f.model.gameOver=true;
 else if(state==='modal')f.h.modal='settings';
 else if(state==='busy')f.flow.busy=true;
 else f.gate.set(state as PauseReason,true);
 try{
  f.h.syncClassicClock();f.at(500000);f.h.syncClassicClock();
  f.h.screen='play';f.h.mode='classic';f.h.modal=null;f.model.gameOver=false;f.flow.busy=false;
  if(!excluded && ['sdk','browser','focus','ad','transition','input','manual'].includes(state))f.gate.set(state as PauseReason,false);
  f.h.syncClassicClock();expect(f.h.tryClassicIntermission()).toBe(false);expect(f.flow.intermission).not.toHaveBeenCalled();
  f.at(590001);expect(f.h.tryClassicIntermission()).toBe(true);expect(f.flow.intermission).toHaveBeenCalledOnce();
 }finally{f.restore();}
});
it('an elapsed clock never requests from update or a held drag; only a completed placement boundary can request',()=>{
 const f=fixture();
 try{
  f.at(90001);f.h.update(90001,16);expect(f.flow.intermission).not.toHaveBeenCalled();
  f.h.drag={slot:0};expect(f.h.tryClassicIntermission()).toBe(false);
  f.h.drag=null;f.ads.eligible=false;expect(f.h.tryClassicIntermission()).toBe(false);
  f.ads.eligible=true;expect(f.h.tryClassicIntermission()).toBe(true);expect(f.flow.intermission).toHaveBeenCalledOnce();
 }finally{f.restore();}
});
it.each(['session','shared-ad'] as const)('%s reset prevents stale active-time eligibility',kind=>{
 const f=fixture();
 try{
  f.at(89999);f.h.syncClassicClock();
  if(kind==='session')f.model.session++;else f.ads.shownRevision++;
  f.h.syncClassicClock();f.at(90001);expect(f.h.tryClassicIntermission()).toBe(false);
  f.at(180000);expect(f.h.tryClassicIntermission()).toBe(true);
 }finally{f.restore();}
});

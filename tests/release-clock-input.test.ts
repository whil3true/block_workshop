import { describe, it, expect, vi } from 'vitest';
import { ClassicAdClock } from '../src/app/ClassicAdClock';
import { SdkInputGuard } from '../src/platform/SdkInputGuard';

describe('active Classic time, with controlled clocks and no timer callbacks', () => {
 it('threshold is 90 active seconds; all inactive intervals are excluded', () => {
  let now = 0; const clock = new ClassicAdClock(() => now);
  now += 500000; expect(clock.due).toBe(false);
  clock.setActive(true); now += 89999; expect(clock.due).toBe(false);
  for (const _reason of ['menu','journal','orders','modal','sdk','browser','focus','ad','defeat','splash']) {
   clock.setActive(false); now += 500000; expect(clock.due).toBe(false); clock.setActive(true);
  }
  now++; expect(clock.due).toBe(true);
  clock.attemptFinished(true); expect(clock.due).toBe(false);
  now += 90000; expect(clock.due).toBe(true);
 });
 it('no-fill retries only after 15 more active seconds and a new placement', () => {
  let now=0; const clock=new ClassicAdClock(()=>now); clock.setActive(true); now=90000;
  expect(clock.due).toBe(true); clock.setActive(false); clock.attemptFinished(false);
  now+=120000; expect(clock.due).toBe(false); clock.setActive(true);
  now+=14999; expect(clock.due).toBe(false); now++; expect(clock.due).toBe(true);
 });
 it('repeated entry creates no timers; reset and destruction invalidate eligibility', () => {
  let now=0; const clock=new ClassicAdClock(()=>now);
  for(let i=0;i<9;i++){clock.setActive(true);now+=10000;clock.setActive(false);now+=100000;}
  expect(clock.due).toBe(true);clock.reset();expect(clock.due).toBe(false);
  clock.setActive(true);now+=90000;clock.dispose();clock.setActive(true);now+=90000;expect(clock.due).toBe(false);
 });
});
describe('SDK input quarantine', () => {
 it('held startup pointer cannot activate the menu on resume or leak a click', async () => {
  const releases: Array<()=>void>=[];
  const guard=new SdkInputGuard(()=>new Promise<void>(r=>releases.push(r)));
  const downstream=vi.fn();window.addEventListener('click',downstream);
  try {
   window.dispatchEvent(new PointerEvent('pointerdown',{pointerId:7,cancelable:true}));
   guard.setBlocked(false);expect(guard.isLocked).toBe(true);expect(releases).toHaveLength(0);
   window.dispatchEvent(new PointerEvent('pointerup',{pointerId:7,cancelable:true}));
   window.dispatchEvent(new MouseEvent('click',{cancelable:true}));expect(downstream).not.toHaveBeenCalled();
   releases.shift()!();await Promise.resolve();expect(guard.isLocked).toBe(false);
   window.dispatchEvent(new MouseEvent('click'));expect(downstream).toHaveBeenCalledOnce();
  } finally {guard.dispose();window.removeEventListener('click',downstream);}
 });
 it('new pause invalidates an outstanding release; disposal removes capture listeners',async()=>{
  const releases:Array<()=>void>=[];const guard=new SdkInputGuard(()=>new Promise<void>(r=>releases.push(r)));
  guard.setBlocked(false);guard.setBlocked(true);releases.shift()!();await Promise.resolve();expect(guard.isLocked).toBe(true);
  guard.setBlocked(false);releases.shift()!();await Promise.resolve();expect(guard.isLocked).toBe(false);
  guard.setBlocked(true);guard.dispose();const event=new MouseEvent('click',{cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);
 });
 it('all simultaneous touches must end; touchcancel releases without a gameplay event',async()=>{
  const releases:Array<()=>void>=[];const guard=new SdkInputGuard(()=>new Promise<void>(r=>releases.push(r)));
  const touch=(type:string,ids:number[])=>{const e=new Event(type,{cancelable:true});Object.defineProperty(e,'changedTouches',{value:ids.map(identifier=>({identifier}))});window.dispatchEvent(e);};
  try{
   touch('touchstart',[1,2]);guard.setBlocked(false);touch('touchend',[1]);expect(releases).toHaveLength(0);
   touch('touchcancel',[2]);releases.shift()!();await Promise.resolve();expect(guard.isLocked).toBe(false);
  }finally{guard.dispose();}
 });
});

describe('navigation shield',()=>{
 it('survives a long advertisement and starts its failsafe only after navigation',async()=>{
  vi.useFakeTimers();
  const {showNavigationCover,hideNavigationCover,armNavigationCoverFallback}=await import('../src/platform/NavigationCover');
  document.body.innerHTML='<main id="app"></main>';
  try{
   showNavigationCover();await vi.advanceTimersByTimeAsync(120000);
   expect(document.getElementById('navigation-cover')!.hidden).toBe(false);
   armNavigationCoverFallback();await vi.advanceTimersByTimeAsync(9999);expect(document.getElementById('navigation-cover')!.hidden).toBe(false);
   hideNavigationCover();await vi.advanceTimersByTimeAsync(1);expect(document.getElementById('navigation-cover')!.hidden).toBe(true);
   showNavigationCover();armNavigationCoverFallback();await vi.advanceTimersByTimeAsync(10000);expect(document.getElementById('navigation-cover')!.hidden).toBe(true);
  }finally{hideNavigationCover();document.body.innerHTML='';vi.useRealTimers();}
 });
});

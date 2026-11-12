import { describe,it,expect,vi,afterEach } from 'vitest';
import { AudioManager, type AudioOutput } from '../src/audio/AudioManager';
import { shouldSuspendAudio } from '../src/app/AudioPausePolicy';
import { PauseGate } from '../src/app/PauseGate';
import { createAudioSettings, parseAudioSettings } from '../src/audio/AudioSettings';
import { WebAudioSettingsStore } from '../src/platform/WebAudioSettingsStore';
import { LocaleRuntime } from '../src/app/LocaleRuntime';
import { attachBrowserAudioLifecycle } from '../src/audio/BrowserAudioLifecycle';
import { HtmlAudioOutput } from '../src/audio/HtmlAudioOutput';
import { gameAudio } from '../src/audio/GameAudio';
function setup(){
 let now=0;const ended:Array<()=>void>=[];
 const output:AudioOutput={onUserGesture:vi.fn(),setEffectsActive:vi.fn(),playEffect:vi.fn(),startMusic:vi.fn((_p,_v,f)=>{ended.push(f);}),setMusicVolume:vi.fn(),pauseMusic:vi.fn(),resumeMusic:vi.fn(),stopMusic:vi.fn()};
 const repo={load:()=>createAudioSettings(.4,.65),save:vi.fn()};const manager=new AudioManager(output,repo,()=>now);
 return {manager,output,repo,ended,advance:(ms:number)=>{now+=ms;}};
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('mixer adapted from Cozy',()=>{
 it('no autoplay before trusted gesture, retries without restarting music',()=>{const s=setup();s.manager.playEffect('place');expect(s.output.startMusic).not.toHaveBeenCalled();expect(s.output.playEffect).not.toHaveBeenCalled();s.manager.unlock();s.manager.unlock();expect(s.output.startMusic).toHaveBeenCalledTimes(1);expect(s.output.resumeMusic).toHaveBeenCalledTimes(1);});
 it('music and effects levels are independent and persisted',()=>{const s=setup();s.manager.unlock();s.manager.setSfxVolume(0);s.manager.playEffect('place');expect(s.output.playEffect).not.toHaveBeenCalled();s.manager.setMusicVolume(.7);expect(s.manager.getSettings()).toEqual({version:1,musicVolume:.7,sfxVolume:0});expect(s.repo.save).toHaveBeenCalledTimes(2);});
 it.each([['page','ad'],['ad','page']] as const)('no resume while %s/%s is still suspended',(a,b)=>{const s=setup();s.manager.unlock();const set=(key:string,v:boolean)=>key==='page'?s.manager.setPageVisible(!v):s.manager.setAdActive(v);set(a,true);set(b,true);set(a,false);s.manager.playEffect('place');expect(s.output.resumeMusic).not.toHaveBeenCalled();expect(s.output.playEffect).not.toHaveBeenCalled();set(b,false);expect(s.output.resumeMusic).toHaveBeenCalledTimes(1);});
 it('per-effect throttle never queues sound for after an ad',()=>{const s=setup();s.manager.unlock();s.manager.playEffect('place');s.manager.playEffect('place');s.manager.playEffect('pickup');expect(s.output.playEffect).toHaveBeenCalledTimes(2);s.manager.setAdActive(true);s.advance(100);s.manager.playEffect('clear');s.manager.setAdActive(false);expect(s.output.playEffect).toHaveBeenCalledTimes(2);});
 it('dispose invalidates old track callbacks',()=>{const s=setup();s.manager.unlock();s.ended[0]!();expect(s.output.startMusic).toHaveBeenCalledTimes(2);s.ended[0]!();expect(s.output.startMusic).toHaveBeenCalledTimes(2);s.manager.dispose();s.ended[1]!();s.manager.unlock();expect(s.output.startMusic).toHaveBeenCalledTimes(2);expect(s.output.stopMusic).toHaveBeenCalledTimes(1);});
 it('mute flag does not overwrite chosen volume levels',()=>{const s=setup(), onMute=vi.fn();const api=gameAudio(s.manager,onMute);s.manager.setMusicVolume(.27);api.setMuted(true);expect(s.manager.getSettings().musicVolume).toBe(.27);expect(localStorage.getItem('block-workshop:mute')).toBe('true');api.setMuted(false);expect(onMute).toHaveBeenLastCalledWith(false);expect(s.manager.getSettings().musicVolume).toBe(.27);});
 it('browser gestures unlock in capture phase, hidden page never retries',()=>{const s=setup();let hidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});const detach=attachBrowserAudioLifecycle(s.manager);window.dispatchEvent(new PointerEvent('pointerdown'));expect(s.output.onUserGesture).toHaveBeenCalledTimes(1);hidden=true;document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new PointerEvent('pointerdown'));expect(s.output.onUserGesture).toHaveBeenCalledTimes(1);detach();hidden=false;delete (document as {hidden?:boolean}).hidden;});
});
describe('settings and language persistence',()=>{
 it('volume settings survive reload and clamp their ranges',()=>{const store=new WebAudioSettingsStore();store.save(createAudioSettings(.2,.8));expect(new WebAudioSettingsStore().load()).toEqual({version:1,musicVolume:.2,sfxVolume:.8});expect(parseAudioSettings('{"version":1,"musicVolume":2,"sfxVolume":-1}')).toEqual({version:1,musicVolume:1,sfxVolume:0});});
 it.each(['invalid','{"version":2,"musicVolume":0,"sfxVolume":0}','null'])('bad settings safely fall back: %s',raw=>{localStorage.setItem('block-workshop:audio-settings',raw);expect(new WebAudioSettingsStore().load().musicVolume).toBe(.4);});
 it('manual language overrides SDK on reload and switches live',()=>{const first=new LocaleRuntime('en');expect(first.locale).toBe('en');const changed=vi.fn();first.subscribe(changed);first.set('ru');expect(first.t('settings')).toBe('Настройки');expect(changed).toHaveBeenCalledTimes(1);expect(new LocaleRuntime('en').locale).toBe('ru');});
 it('storage unavailable keeps in-memory language and settings',()=>{vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('denied');});vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('denied');});const locale=new LocaleRuntime('en');expect(()=>locale.set('ru')).not.toThrow();expect(locale.locale).toBe('ru');expect(()=>new WebAudioSettingsStore().save(createAudioSettings(.1,.2))).not.toThrow();});
});
describe('Android media-session mechanism (mock, not hardware)',()=>{
 it('releases source on background and resumes at saved position, ignores old ended',()=>{
  const instances:FakeAudio[]=[];
  class FakeAudio {
   src:string;currentTime=0;paused=true;readyState=1;volume=1;preload='';loop=false;plays=0;listeners=new Map<string,()=>void>();
   constructor(src:string){this.src=src;instances.push(this);}
   load(){} play(){this.plays++;this.paused=false;return Promise.resolve();}pause(){this.paused=true;}
   removeAttribute(name:string){if(name==='src')this.src='';}addEventListener(name:string,f:()=>void){this.listeners.set(name,f);}
  }
  vi.stubGlobal('Audio',FakeAudio);vi.stubGlobal('AudioContext',undefined);
  const media={playbackState:'playing',metadata:{title:'test'}};Object.defineProperty(navigator,'mediaSession',{configurable:true,value:media});
  const manager=new AudioManager(new HtmlAudioOutput(),{load:()=>createAudioSettings(.4,.65),save:()=>{}});manager.unlock();
  const first=instances.find(a=>a.src.endsWith('workshop.wav')&&a.plays>0)!;first.currentTime=12.5;manager.setPageVisible(false);
  expect(first.src).toBe('');expect(first.paused).toBe(true);expect(media.playbackState).toBe('none');expect(media.metadata).toBeNull();first.listeners.get('ended')?.();
  manager.setPageVisible(true);const second=instances.find(a=>a!==first&&a.src.endsWith('workshop.wav'))!;expect(second.currentTime).toBe(12.5);expect(first.plays).toBe(1);manager.dispose();
 });
});

describe('audio ownership during Phaser settings dialogs',()=>{
 it('keeps music and UI effects audible through manual pause, including volume adjustments',()=>{
  const s=setup(),gate=new PauseGate();gate.set('startup',true);
  const stop=gate.subscribe(()=>s.manager.setAdActive(shouldSuspendAudio(gate)));
  s.manager.unlock();
  expect(s.output.startMusic).toHaveBeenCalledTimes(1);
  gate.set('startup',false);gate.set('manual',true);
  expect(gate.paused).toBe(true);
  expect(s.output.pauseMusic).not.toHaveBeenCalled();
  s.manager.playEffect('pickup');
  expect(s.output.playEffect).toHaveBeenCalledTimes(1);
  s.manager.setMusicVolume(.75);
  s.manager.setSfxVolume(.3);
  expect(s.output.setMusicVolume).toHaveBeenLastCalledWith(.75);
  expect(s.manager.getSettings()).toMatchObject({musicVolume:.75,sfxVolume:.3});
  gate.set('manual',false);
  expect(s.output.pauseMusic).not.toHaveBeenCalled();
  expect(s.output.resumeMusic).not.toHaveBeenCalled();
  stop();s.manager.dispose();
 });
 it.each(['sdk','browser','ad','transition'] as const)('%s still silences audio and resumes inside an open settings dialog',reason=>{
  const s=setup(),gate=new PauseGate();
  const stop=gate.subscribe(()=>s.manager.setAdActive(shouldSuspendAudio(gate)));
  s.manager.unlock();
  gate.set('manual',true);gate.set(reason,true);
  expect(s.output.pauseMusic).toHaveBeenCalledTimes(1);
  s.manager.playEffect('pickup');
  expect(s.output.playEffect).not.toHaveBeenCalled();
  gate.set(reason,false);
  expect(gate.has('manual')).toBe(true);
  expect(s.output.resumeMusic).toHaveBeenCalledTimes(1);
  s.manager.playEffect('pickup');
  expect(s.output.playEffect).toHaveBeenCalledTimes(1);
  stop();s.manager.dispose();
 });
 it('does not restore sound until the final external pause owner is released',()=>{
  const s=setup(),gate=new PauseGate();
  const stop=gate.subscribe(()=>s.manager.setAdActive(shouldSuspendAudio(gate)));
  s.manager.unlock();
  gate.set('manual',true);gate.set('sdk',true);gate.set('ad',true);
  expect(s.output.pauseMusic).toHaveBeenCalledTimes(1);
  gate.set('sdk',false);
  expect(s.output.resumeMusic).not.toHaveBeenCalled();
  gate.set('ad',false);
  expect(s.output.resumeMusic).toHaveBeenCalledTimes(1);
  expect(gate.paused).toBe(true);
  stop();s.manager.dispose();
 });
});

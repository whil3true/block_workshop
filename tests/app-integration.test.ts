import { describe,it,expect,vi,afterEach } from 'vitest';
vi.mock('../src/audio/HtmlAudioOutput',()=>({HtmlAudioOutput:class {onUserGesture(){}setEffectsActive(){}playEffect(){}startMusic(){}setMusicVolume(){}pauseMusic(){}resumeMusic(){}stopMusic(){}}}));
import { mountApplication, boot } from './legacy/app/bootstrap';
import { WebPlatform } from '../src/platform/WebPlatform';
import { attachBrowserGameplayLifecycle } from '../src/app/BrowserGameplayLifecycle';
let app:ReturnType<typeof mountApplication>|undefined;
afterEach(()=>{app?.destroy();app=undefined;vi.restoreAllMocks();document.body.replaceChildren();});
const html=()=>{document.body.innerHTML='<div id="boot"></div><div id="app"></div>';};
const start=()=>document.querySelector<HTMLButtonElement>('.welcome [data-word="play"], .welcome [data-word="resume"]')!.click();
const settle=async()=>{await Promise.resolve();await Promise.resolve();};
describe('DOM application lifecycle',()=>{
 it('mounts once, ready after frame, gameplay only after Play',async()=>{
  html();const platform=new WebPlatform('en');const ready=vi.spyOn(platform,'ready'),active=vi.spyOn(platform,'setGameplayActive');let release!:()=>void;
  app=mountApplication(platform,()=>new Promise<void>(r=>{release=r;}));expect(document.querySelectorAll('.board__cell')).toHaveLength(100);expect(ready).not.toHaveBeenCalled();start();expect(app.gate.has('startup')).toBe(true);
  release();await settle();expect(ready).toHaveBeenCalledTimes(1);start();expect(app.gate.paused).toBe(false);expect(active).toHaveBeenLastCalledWith(true);
 });
 it('pause cancels active ghost and preview; resumed SDK cannot clear browser pause',async()=>{
  html();app=mountApplication(new WebPlatform('en'),async()=>{});await settle();start();
  document.querySelector('.tray__slot')!.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1}));expect(document.querySelector('.ghost')).not.toBeNull();
  app.gate.set('sdk',true);app.gate.set('browser',true);expect(document.querySelector('.ghost')).toBeNull();expect(document.querySelector('[data-picked]')).toBeNull();
  app.gate.set('sdk',false);app.game.place(0,0,0);expect(app.game.score).toBe(0);app.gate.set('browser',false);app.game.place(0,0,0);expect(app.game.score).toBeGreaterThan(0);
 });
 it('settings pauses game; live RU/EN does not reload or reset the board',async()=>{
  html();app=mountApplication(new WebPlatform('en'),async()=>{});await settle();start();app.game.place(0,0,0);const score=app.game.score;
  document.querySelector<HTMLButtonElement>('.appbar button')!.click();expect(app.gate.has('manual')).toBe(true);app.game.place(1,5,5);expect(app.game.score).toBe(score);
  const ru=Array.from(document.querySelectorAll<HTMLButtonElement>('.modal button')).find(b=>b.textContent==='RU')!;ru.click();expect(document.documentElement.lang).toBe('ru');expect(document.title).toBe('Мастерская блоков');expect(app.game.score).toBe(score);
  document.querySelector<HTMLButtonElement>('.modal [data-word="close"]')!.click();expect(app.gate.paused).toBe(false);
 });
 it('opens Settings from the main menu without immediately toggling locale', async()=>{
  html();app=mountApplication(new WebPlatform('en'),async()=>{});await settle();
  const before=document.documentElement.lang;
  expect(document.querySelector('.welcome [data-word="language"]')).toBeNull();
  document.querySelector<HTMLButtonElement>('.welcome [data-word="settings"]')!.click();
  expect(app.gate.has('startup')).toBe(true);expect(app.gate.has('manual')).toBe(true);
  expect(document.querySelectorAll('.modal input[type="range"]')).toHaveLength(2);
  expect(document.documentElement.lang).toBe(before);
  document.querySelector<HTMLButtonElement>('.modal [data-word="close"]')!.click();
  expect(app.gate.has('startup')).toBe(true);expect(app.gate.has('manual')).toBe(false);
  start();expect(app.gate.paused).toBe(false);
 });
 it('Menu preserves the board and removes duplicate Mute controls',async()=>{
  html();localStorage.setItem('block-workshop:mute','true');
  const platform=new WebPlatform('en');const marker=vi.spyOn(platform,'setGameplayActive');
  app=mountApplication(platform,async()=>{});await settle();start();
  expect(localStorage.getItem('block-workshop:mute')).toBe('false');
  expect(document.querySelector('.hud__mute')).toBeNull();
  app.game.place(0,0,0);const before=app.game.boardState.map(row=>row.slice());const score=app.game.score;
  document.querySelector<HTMLButtonElement>('.appbar [data-word="menu"]')!.click();
  expect(app.gate.has('startup')).toBe(true);
  expect(document.querySelector<HTMLElement>('.welcome')!.hidden).toBe(false);
  expect(marker).toHaveBeenLastCalledWith(false);expect(app.game.score).toBe(score);
  start();expect(app.gate.paused).toBe(false);expect(app.game.boardState).toEqual(before);
  expect(app.game.score).toBe(score);expect(marker).toHaveBeenLastCalledWith(true);
 });
 it('starts a fresh game after a finished saved session instead of reopening Game Over',async()=>{
  html();
  localStorage.setItem('block-workshop:lastGame',JSON.stringify({
   app:'block-workshop',schemaVersion:1,rulesVersion:1,
   state:{
    board:Array.from({length:10},()=>Array(10).fill('sq2')),
    trayIds:['single','single','single'],score:75,streak:0,rewardUsed:false,
   },
  }));
  app=mountApplication(new WebPlatform('en'),async()=>{});await settle();
  expect(app.game.gameOver).toBe(true);
  expect(document.querySelector<HTMLElement>('.overlay')?.dataset['visible']).toBe('true');
  expect(document.querySelector('.welcome [data-word="resume"]')).toBeNull();
  start();
  expect(app.game.gameOver).toBe(false);
  expect(app.game.score).toBe(0);
  expect(app.game.boardState.every(row=>row.every(cell=>cell===null))).toBe(true);
  expect(document.querySelector<HTMLElement>('.overlay')?.dataset['visible']).toBe('false');
  expect(document.querySelector<HTMLElement>('.welcome')?.hidden).toBe(true);
  document.querySelector<HTMLButtonElement>('.appbar [data-word="menu"]')!.click();
  expect(document.querySelector<HTMLElement>('.welcome')?.hidden).toBe(false);
  start();
  expect(app.game.gameOver).toBe(false);
  expect(document.querySelector<HTMLElement>('.overlay')?.dataset['visible']).toBe('false');
 });

 it('never reintroduces English game labels after placement in a Russian session',async()=>{
  html();app=mountApplication(new WebPlatform('en'),async()=>{});await settle();
  app.locale.set('ru');start();
  expect(document.querySelector('.hud__pair--current .hud__label')?.textContent).toBe('Счёт');
  app.game.place(0,0,0);
  expect(document.querySelector('.hud__pair--current .hud__label')?.textContent).toBe('Счёт');
  expect(document.querySelector('.hud__pair--best .hud__label')?.textContent).toBe('Рекорд');
  expect(document.querySelector('.overlay__heading')?.textContent).toBe('Нет доступных ходов');
  expect(document.querySelector('.overlay__button')?.textContent).toBe('Новая игра');
 });
 it.each(['resize','orientationchange'])('%s cancels drag without consuming a piece',async event=>{
  html();app=mountApplication(new WebPlatform('en'),async()=>{});await settle();start();const ids=app.game.trayPieces.map(p=>p?.id);
  document.querySelector('.tray__slot')!.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1}));window.dispatchEvent(new Event(event));expect(document.querySelector('.ghost')).toBeNull();expect(app.game.trayPieces.map(p=>p?.id)).toEqual(ids);
 });
 it('initial SDK pause holds splash; late consumer stays blocked until actual resume',async()=>{
  html();const platform={...new WebPlatform('en'),id:'yandex' as const,displayName:'mock',locale:'ru',isPaused:true,ready:vi.fn(),setGameplayActive:vi.fn(),showRewarded:async()=>false,showInterstitial:async()=>false,onPause:()=>()=>{},onResume:()=>()=>{}};
  app=mountApplication(platform,async()=>{});await settle();expect(platform.ready).not.toHaveBeenCalled();expect(document.getElementById('boot')).not.toBeNull();app.gate.set('sdk',false);await settle();expect(platform.ready).toHaveBeenCalledTimes(1);
 });
 it('bootstrap failure does not mount a playable fake fallback',async()=>{html();await expect(boot(async()=>{throw Error('SDK unavailable');})).rejects.toThrow('SDK unavailable');expect(document.querySelector('.board')).toBeNull();});
 it('browser lifecycle handles pagehide/pageshow and detaches',()=>{const bg=vi.fn(),fg=vi.fn();const detach=attachBrowserGameplayLifecycle({onBackground:bg,onForeground:fg});window.dispatchEvent(new Event('pagehide'));expect(bg).toHaveBeenCalledTimes(1);window.dispatchEvent(new Event('pageshow'));expect(fg).toHaveBeenCalledTimes(1);detach();window.dispatchEvent(new Event('pagehide'));expect(bg).toHaveBeenCalledTimes(1);});
});

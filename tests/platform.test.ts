import { describe, it, expect, vi, afterEach } from 'vitest';
import { YandexPlatform } from '../src/platform/YandexPlatform';
import { InterstitialController } from '../src/platform/InterstitialController';
import { createPlatform, isStandaloneHost, loadYandexSdk } from '../src/platform/createPlatform';
import { WebPlatform } from '../src/platform/WebPlatform';
import type { YandexSdk, YandexLifecycleEvent } from '../src/platform/YandexSdkTypes';
import { PauseGate } from '../src/app/PauseGate';
import { AdFlow } from '../src/app/AdFlow';

function fixture() {
 const events = new Map<string, () => void>();
 let full: NonNullable<Parameters<NonNullable<YandexSdk['adv']>['showFullscreenAdv']>[0]>;
 let rewarded: Parameters<NonNullable<YandexSdk['adv']>['showRewardedVideo']>[0];
 const sdk: YandexSdk = {
  on: (e, f) => { events.set(e,f); }, off: (e) => { events.delete(e); },
  features: { LoadingAPI: { ready: vi.fn() }, GameplayAPI: { start: vi.fn(), stop: vi.fn() } },
  adv: { showFullscreenAdv: vi.fn(o => { full=o!; }), showRewardedVideo: vi.fn(o => { rewarded=o; }) }
 };
 const platform = new YandexPlatform(sdk);
 return { platform, sdk, event: (e: YandexLifecycleEvent) => events.get(e)?.(), full: () => full!.callbacks!, reward: () => rewarded!.callbacks };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('SDK callbacks and watchdogs', () => {
 it.each(['close-first','resume-first'] as const)('navigation settles independently: %s', async order => {
  const f = fixture(); const opened = vi.fn(); const done = vi.fn();
  const request = f.platform.showInterstitial(opened).then(done);
  f.full().onOpen?.(); f.event('game_api_pause');
  if (order === 'resume-first') f.event('game_api_resume');
  f.full().onClose?.(true); await request;
  expect(done).toHaveBeenCalledTimes(1); expect(done).toHaveBeenCalledWith(true); expect(opened).toHaveBeenCalledTimes(1);
  expect(f.platform.isPaused).toBe(order === 'close-first');
  f.event('game_api_resume'); expect(f.platform.isPaused).toBe(false);
 });
 it.each(['no-fill','error','throw','pre-open-timeout','post-open-timeout'] as const)('recovers from %s, ignores late callbacks', async kind => {
  vi.useFakeTimers(); const f = fixture(); const opened = vi.fn();
  if (kind === 'throw') vi.mocked(f.sdk.adv!.showFullscreenAdv).mockImplementation(() => { throw Error('offline'); });
  const p = f.platform.showInterstitial(opened);
  if (kind === 'no-fill') f.full().onClose?.(false);
  if (kind === 'error') f.full().onError?.({});
  if (kind === 'pre-open-timeout') await vi.advanceTimersByTimeAsync(15000);
  if (kind === 'post-open-timeout') { f.full().onOpen?.(); await vi.advanceTimersByTimeAsync(120000); }
  expect(await p).toBe(false);
  if (kind !== 'throw') { const n = opened.mock.calls.length; f.full().onOpen?.(); f.full().onClose?.(true); expect(opened).toHaveBeenCalledTimes(n); }
 });
 it.each([true,false])('reward requires onRewarded=%s; duplicated/late callback ignored', async granted => {
  const f = fixture(); const done=vi.fn(); const p=f.platform.showRewarded().then(done);
  if (granted) { f.reward().onRewarded?.(); f.reward().onRewarded?.(); }
  f.reward().onClose?.(); await p; f.reward().onRewarded?.(); f.reward().onClose?.();
  expect(done).toHaveBeenCalledTimes(1); expect(done).toHaveBeenCalledWith(granted);
 });
 it('reward timeout releases request without a free reward', async () => {
  vi.useFakeTimers(); const f=fixture(); const p=f.platform.showRewarded(); await vi.advanceTimersByTimeAsync(120000);
  expect(await p).toBe(false); f.reward().onRewarded?.();
 });
 it.each(['error','throw'] as const)('reward %s never awards without callback', async kind => {
  const f=fixture(); if(kind==='throw') vi.mocked(f.sdk.adv!.showRewardedVideo).mockImplementation(() => {throw Error('fail');});
  const p=f.platform.showRewarded(); if(kind==='error') f.reward().onError?.({}); expect(await p).toBe(false);
 });
 it('late pause subscribers see current state; ready and gameplay are idempotent', () => {
  const f=fixture(); f.event('game_api_pause'); const listener=vi.fn(); const detach=f.platform.onPause(listener);
  expect(listener).toHaveBeenCalledTimes(1); detach(); f.event('game_api_resume'); f.event('game_api_pause'); expect(listener).toHaveBeenCalledTimes(1);
  f.platform.ready();f.platform.ready(); expect(f.sdk.features!.LoadingAPI!.ready).toHaveBeenCalledTimes(1);
  f.platform.setGameplayActive(true);f.platform.setGameplayActive(true);f.platform.setGameplayActive(false);
  expect(f.sdk.features!.GameplayAPI!.start).toHaveBeenCalledTimes(1); expect(f.sdk.features!.GameplayAPI!.stop).toHaveBeenCalledTimes(1);
 });
});
describe('shared pending transaction and pause reasons', () => {
 it.each([['sdk','browser'],['browser','sdk'],['manual','sdk']] as const)('independent %s and %s', (a,b) => {
  const gate=new PauseGate(); gate.set(a,true);gate.set(b,true);gate.set(a,false);expect(gate.paused).toBe(true);gate.set(b,false);expect(gate.paused).toBe(false);
 });
 it('one ad in flight, destination exactly once before SDK resume, cover after frame', async () => {
  const f=fixture(), gate=new PauseGate(); let now=0; const ads=new InterstitialController(f.platform,()=>now); now=90001;
  const restart=vi.fn(), applyReward=vi.fn(), cover=vi.fn(); let release!: () => void;
  f.platform.onPause(()=>gate.set('sdk',true));f.platform.onResume(()=>gate.set('sdk',false));
  const flow=new AdFlow({gate,platform:f.platform,interstitial:ads,restart,applyReward,cover,afterFrame:()=>new Promise<void>(r=>{release=r;})});
  const p=flow.restart(); await flow.restart(); await flow.reward({session:1,revision:0});
  expect(f.sdk.adv!.showFullscreenAdv).toHaveBeenCalledTimes(1);expect(f.sdk.adv!.showRewardedVideo).not.toHaveBeenCalled();expect(cover).not.toHaveBeenCalled();
  f.full().onOpen?.();f.event('game_api_pause');f.full().onClose?.(true);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  expect(restart).toHaveBeenCalledTimes(1);expect(gate.has('sdk')).toBe(true);expect(cover).toHaveBeenLastCalledWith(true);
  release();await p;expect(cover).toHaveBeenLastCalledWith(false);expect(gate.paused).toBe(true);f.event('game_api_resume');expect(gate.paused).toBe(false);
  f.full().onClose?.(true);expect(restart).toHaveBeenCalledTimes(1);
 });
 it('no-fill/cooldown never paints a navigation cover', async () => {
  const f=fixture(), gate=new PauseGate(), cover=vi.fn(), restart=vi.fn();
  const flow=new AdFlow({gate,platform:f.platform,interstitial:new InterstitialController(f.platform),restart,applyReward:()=>true,cover,afterFrame:async()=>{}});
  await flow.restart(); expect(restart).toHaveBeenCalledTimes(1);expect(cover.mock.calls.some(c=>c[0]===true)).toBe(false);expect(gate.paused).toBe(false);
 });
 it('stages a reward until both SDK and browser resume', async () => {
  const f=fixture(), gate=new PauseGate(), applyReward=vi.fn(()=>true);
  const flow=new AdFlow({gate,platform:f.platform,interstitial:{tryShow:async()=>false},restart:()=>{},applyReward,cover:()=>{},afterFrame:async()=>{}});
  const p=flow.reward({session:1,revision:0});gate.set('sdk',true);gate.set('browser',true);f.reward().onRewarded?.();f.reward().onClose?.();await p;
  flow.flushReward();expect(applyReward).not.toHaveBeenCalled();gate.set('sdk',false);flow.flushReward();expect(applyReward).not.toHaveBeenCalled();gate.set('browser',false);flow.flushReward();flow.flushReward();expect(applyReward).toHaveBeenCalledTimes(1);
 });
 it('controller respects cooldown, retry, pending and retries after failure', async () => {
  let now=0, resolve!: (b:boolean)=>void;
  const show=vi.fn(()=>new Promise<boolean>(r=>{resolve=r;}));const c=new InterstitialController({id:'yandex',showInterstitial:show},()=>now);
  expect(await c.tryShow()).toBe(false);now=90000;const p=c.tryShow();expect(await c.tryShow()).toBe(false);resolve(false);await p;
  now+=100;expect(await c.tryShow()).toBe(false);now+=15000;const p2=c.tryShow();resolve(true);await p2;
  expect(show).toHaveBeenCalledTimes(2);now+=80000;expect(await c.tryShow()).toBe(false);
 });
});
describe('explicit standalone policy and failed bootstrap', () => {
 it.each(['localhost','127.0.0.1','[::1]','whil3true.github.io'])('allows %s',host=>expect(isStandaloneHost(host)).toBe(true));
 it.each(['example.com','yandex.ru','evil.github.io','localhost.example.com'])('requires SDK on %s',host=>expect(isStandaloneHost(host)).toBe(false));
 it('SDK failure is not silently replaced with WebPlatform',async()=>{
  const fallback=vi.fn(()=>new WebPlatform());await expect(createPlatform({isStandalone:false,loadSdk:async()=>{throw Error('offline');},fallback})).rejects.toThrow('offline');expect(fallback).not.toHaveBeenCalled();
 });
 it('LAN preview is allowed only by an explicit exact dev hostname',()=>{expect(isStandaloneHost('192.168.1.5',['192.168.1.5'])).toBe(true);expect(isStandaloneHost('192.168.1.6',['192.168.1.5'])).toBe(false);expect(isStandaloneHost('evil192.168.1.5',['192.168.1.5'])).toBe(false);});
 it('web never grants a pretend advertisement reward',async()=>expect(await new WebPlatform().showRewarded()).toBe(false));
 it('script failure removes script and rejects',async()=>{
  const p=loadYandexSdk(window,document);const script=document.querySelector<HTMLScriptElement>('script[src="/sdk.js"]')!;script.dispatchEvent(new Event('error'));
  await expect(p).rejects.toThrow('unavailable');expect(document.contains(script)).toBe(false);
 });
});

it('a campaign destination uses the shared transaction without restarting classic or showing an ad',async()=>{
 const gate=new PauseGate(), destination=vi.fn(), restart=vi.fn(), ad=vi.fn(async()=>false);
 const flow=new AdFlow({gate,platform:new WebPlatform('ru'),interstitial:{tryShow:ad},restart,applyReward:()=>false,cover:()=>{},afterFrame:async()=>{}});
 await flow.transition(destination,false);
 expect(destination).toHaveBeenCalledTimes(1);expect(restart).not.toHaveBeenCalled();expect(ad).not.toHaveBeenCalled();expect(gate.paused).toBe(false);
});

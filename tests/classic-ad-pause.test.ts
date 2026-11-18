import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { WorkshopScene, type SceneServices } from '../src/phaser/WorkshopScene';
import { createModel } from '../src/model';
import { saveLastGame, loadLastGame } from '../src/storage';
import { createEmptyBoard } from '../src/engine';
import { PauseGate } from '../src/app/PauseGate';
import { AdFlow } from '../src/app/AdFlow';
import { attachBrowserGameplayLifecycle } from '../src/app/BrowserGameplayLifecycle';
import { shouldSuspendAudio } from '../src/app/AudioPausePolicy';
import { AudioManager, type AudioOutput } from '../src/audio/AudioManager';
import { createAudioSettings } from '../src/audio/AudioSettings';
import { InterstitialController } from '../src/platform/InterstitialController';
import { YandexPlatform } from '../src/platform/YandexPlatform';
import type { YandexSdk, YandexLifecycleEvent } from '../src/platform/YandexSdkTypes';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
type SceneHarness = {
 syncClassicClock(): void; release(pointer: { id: number }): void;
 drag: { pointerId: number; slot: number; piece: NonNullable<ReturnType<typeof createModel>['trayPieces'][number]>; x: number; y: number } | null;
};

function fixture() {
 vi.useFakeTimers();
 let now = 0;
 vi.spyOn(performance, 'now').mockImplementation(() => now);
 const gate = new PauseGate(), events = new Map<string, () => void>();
 saveLastGame({ board: createEmptyBoard(), trayIds: ['single', 'single', 'single'], score: 0, streak: 0 });
 const model = createModel({ canInteract: () => !gate.paused });
 let callbacks: NonNullable<Parameters<NonNullable<YandexSdk['adv']>['showFullscreenAdv']>[0]>['callbacks'];
 const request = vi.fn((options: Parameters<NonNullable<YandexSdk['adv']>['showFullscreenAdv']>[0]) => {
  // This assertion runs at the actual SDK call, not after the advertisement.
  expect(model.revision).toBe(1);
  expect(loadLastGame()?.score).toBe(1);
  expect(loadLastGame()?.board).toEqual(model.boardState);
  callbacks = options!.callbacks;
 });
 const sdk: YandexSdk = {
  on: (event, listener) => { events.set(event, listener); }, off: event => { events.delete(event); },
  adv: { showFullscreenAdv: request, showRewardedVideo: vi.fn() },
 };
 const platform = new YandexPlatform(sdk), ads = new InterstitialController(platform, () => now);
 platform.onPause(() => gate.set('sdk', true));
 platform.onResume(() => gate.set('sdk', false));
 const detachBrowser = attachBrowserGameplayLifecycle({
  onBackground: () => gate.set('browser', true), onForeground: () => gate.set('browser', false),
 });
 const output: AudioOutput = { playEffect: vi.fn(), startMusic: vi.fn(), setMusicVolume: vi.fn(),
  pauseMusic: vi.fn(), resumeMusic: vi.fn(), stopMusic: vi.fn(), setEffectsActive: vi.fn() };
 const audio = new AudioManager(output, { load: () => createAudioSettings(.4, .65), save: vi.fn() }, () => now);
 const cover = vi.fn(), flow = new AdFlow({ gate, platform, interstitial: ads, cover,
  afterFrame: async () => {}, restart: vi.fn(), applyReward: () => false });
 const scene = new WorkshopScene({ gate, platform, model, interstitial: ads, flow } as unknown as SceneServices);
 const h = scene as unknown as SceneHarness;
 Object.assign(scene, { ready: true, screen: 'play', mode: 'classic', dirty: false,
  move: () => {}, effects: { removeAll: vi.fn() } });
 const detachGate = gate.subscribe(() => { audio.setAdActive(shouldSuspendAudio(gate)); scene.onPauseChange(); });
 audio.unlock();
 h.syncClassicClock();
 now = 90_001;
 h.drag = { pointerId: 1, slot: 0, piece: model.trayPieces[0]!, x: 42, y: 178 };
 h.release({ id: 1 });
 return { gate, model, flow, output, cover, request, full: () => callbacks!,
  event: (event: YandexLifecycleEvent) => events.get(event)?.(),
  releaseAgain: () => h.release({ id: 1 }),
  dispose: () => { detachGate(); detachBrowser(); audio.dispose(); platform.destroy(); flow.dispose(); } };
}

describe('Classic completed drop → SDK transaction → independent pause release', () => {
 it.each(['close-first', 'resume-first', 'no-fill', 'error-before-open', 'error-after-open', 'background'] as const)(
  '%s preserves exactly one saved placement and returns control only after every pause owner releases', async kind => {
   const f = fixture();
   try {
    const saved = localStorage.getItem('block-workshop:lastGame');
    expect(f.request).toHaveBeenCalledOnce();
    expect(f.model.revision).toBe(1);
    expect(f.gate.has('transition')).toBe(true);
    expect(f.output.pauseMusic).not.toHaveBeenCalled();
    f.model.place(1, 0, 1); f.releaseAgain();
    expect(await f.flow.intermission()).toBe(false);
    expect(f.request).toHaveBeenCalledOnce();
    expect(f.model.revision).toBe(1);
    if (kind !== 'no-fill' && kind !== 'error-before-open') {
     f.full().onOpen?.(); f.full().onOpen?.(); f.event('game_api_pause');
     expect(f.cover.mock.calls.filter(([visible]) => visible)).toHaveLength(1);
     expect(f.output.pauseMusic).toHaveBeenCalledOnce();
    }
    if (kind === 'background') window.dispatchEvent(new Event('pagehide'));
    if (kind === 'resume-first') f.event('game_api_resume');
    if (kind.startsWith('error')) f.full().onError?.({});
    else f.full().onClose?.(kind !== 'no-fill');
    await vi.advanceTimersByTimeAsync(0);
    expect(f.flow.busy).toBe(false);
    expect(f.gate.has('transition')).toBe(false);
    expect(f.gate.has('ad')).toBe(false);
    if (f.gate.has('sdk')) {
     expect(f.output.resumeMusic).not.toHaveBeenCalled();
     f.model.place(1, 0, 1); expect(f.model.revision).toBe(1);
     f.event('game_api_resume');
    }
    if (kind === 'background') {
     expect(f.gate.paused).toBe(true);
     expect(f.output.resumeMusic).not.toHaveBeenCalled();
     f.model.place(1, 0, 1); expect(f.model.revision).toBe(1);
     window.dispatchEvent(new Event('pageshow'));
    }
    expect(f.gate.paused).toBe(false);
    if (kind === 'no-fill' || kind === 'error-before-open') {
     expect(f.output.pauseMusic).not.toHaveBeenCalled();
     expect(f.output.resumeMusic).not.toHaveBeenCalled();
    } else expect(f.output.resumeMusic).toHaveBeenCalledOnce();
    // Late/duplicated callbacks cannot replay the drop or re-open the cover.
    f.full().onClose?.(true); f.full().onError?.({}); f.full().onOpen?.(); f.releaseAgain();
    expect(f.gate.paused).toBe(false);
    expect(f.model.revision).toBe(1);
    expect(localStorage.getItem('block-workshop:lastGame')).toBe(saved);
    expect(f.request).toHaveBeenCalledOnce();
    f.model.place(1, 0, 1);
    expect(f.model.revision).toBe(2);
    expect(loadLastGame()?.score).toBe(2);
   } finally { f.dispose(); }
  });
});

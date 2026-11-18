import Phaser from 'phaser';
import { CampaignController } from '../campaign/CampaignSession';
import { createModel, type TrayOffer } from '../model';
import { createPlatform } from '../platform/createPlatform';
import type { PlatformService } from '../platform/PlatformService';
import { InterstitialController } from '../platform/InterstitialController';
import { AudioManager } from '../audio/AudioManager';
import { HtmlAudioOutput } from '../audio/HtmlAudioOutput';
import { WebAudioSettingsStore } from '../platform/WebAudioSettingsStore';
import { attachBrowserAudioLifecycle } from '../audio/BrowserAudioLifecycle';
import { configureAudioRuntime } from '../audio/AudioRuntime';
import { gameAudio } from '../audio/GameAudio';
import { attachBrowserGameplayLifecycle } from './BrowserGameplayLifecycle';
import { LocaleRuntime } from './LocaleRuntime';
import { PauseGate } from './PauseGate';
import { shouldSuspendAudio } from './AudioPausePolicy';
import { showNavigationCover, hideNavigationCover, armNavigationCoverFallback } from '../platform/NavigationCover';
import { SdkInputGuard } from '../platform/SdkInputGuard';
import { AdFlow } from './AdFlow';
import { WorkshopScene } from '../phaser/WorkshopScene';
import { computeRenderScale, selectStartupRenderScale, isDesktopBrowserUserAgent, LOGICAL_GAME_WIDTH, LOGICAL_GAME_HEIGHT } from '../phaser/Display';

export const afterFrame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
// One release frame consumes the old pointerup/click. Rebuilt hit areas enter
// Phaser's input list on the following frame, alongside their first visible render.
const afterInputFrame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()));
export async function boot(platformFactory = createPlatform) {
 // Initialize SDK and retain startup events before constructing Phaser/audio.
 const inputGuard = new SdkInputGuard(afterInputFrame);
 try {
  const platform = await platformFactory();
  await document.fonts.load('700 24px Nunito').catch(() => {});
  return mountApplication(platform, inputGuard);
 } catch (error) { inputGuard.dispose(); throw error; }
}
export function mountApplication(platform: PlatformService, inputGuard = new SdkInputGuard(afterInputFrame)) {
 const gate = new PauseGate(); gate.set('startup', true); gate.set('sdk', platform.isPaused);
 let scene: WorkshopScene | undefined;
 const detachSdkPause = platform.onPause(() => gate.set('sdk', true));
 const detachSdkResume = platform.onResume(() => gate.set('sdk', false));
 const detachBrowser = attachBrowserGameplayLifecycle({ onBackground: () => gate.set('browser', true), onForeground: () => gate.set('browser', false) });
 const detachInput = inputGuard.subscribe(() => {
  gate.set('input', inputGuard.isLocked);
  if (!inputGuard.isLocked) scene?.refreshAfterExternalRelease();
 });
 const blur = (): void => gate.set('focus', true);
 const focus = (): void => gate.set('focus', false);
 window.addEventListener('blur', blur); window.addEventListener('focus', focus);
 const locale = new LocaleRuntime(platform.id === 'yandex' ? platform.locale : undefined);
 const translate = (canvas?: HTMLCanvasElement): void => {
  const title = locale.t('title');
  document.documentElement.lang = locale.locale;
  document.title = title;
  canvas?.setAttribute('aria-label', title);
  scene?.invalidate();
 };
 translate();
 const manager = new AudioManager(new HtmlAudioOutput(), new WebAudioSettingsStore());
 configureAudioRuntime(manager);
 const detachAudio = attachBrowserAudioLifecycle(manager);
 const audio = gameAudio(manager, () => {}); audio.setMuted(false);
 const model = createModel({ audio, canInteract: () => !gate.paused,
  onChange: () => scene?.invalidate(), onCombo: streak => scene?.showCombo(streak) });
 const campaign = new CampaignController(() => scene?.invalidate(), () => !gate.paused);
 const interstitial = new InterstitialController(platform);
 const flow = new AdFlow<TrayOffer>({ gate, platform, interstitial,
  cover: visible => { if (visible) showNavigationCover(); else hideNavigationCover(); scene?.setCover(visible); },
  afterFrame: async () => { armNavigationCoverFallback(); await afterFrame(); },
  refreshAfterTransition: () => scene?.refreshAfterExternalRelease(),
  restart: () => model.commitRestart(), applyReward: offer => model.commitReward(offer) });
 const density = selectStartupRenderScale(computeRenderScale(window.devicePixelRatio || 1, window.innerWidth, window.innerHeight), isDesktopBrowserUserAgent(navigator.userAgent, navigator.maxTouchPoints));
 scene = new WorkshopScene({ model, campaign, gate, locale, manager, audio, platform, flow, interstitial, density });
 const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'app', transparent: true, scene: [scene],
  audio: { noAudio: true }, // The shared Cozy audio lifecycle owns media and Web Audio.
  input: { activePointers: 2 },
  scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.NO_CENTER, expandParent: false,
   width: LOGICAL_GAME_WIDTH * density, height: LOGICAL_GAME_HEIGHT * density },
 });
 const detachLocale = locale.subscribe(() => translate(game.canvas));
 const detachGate = gate.subscribe(() => {
  inputGuard.setBlocked(gate.has('sdk') || gate.has('browser') || gate.has('focus') || gate.has('ad'));
  manager.setAdActive(shouldSuspendAudio(gate));
  scene?.onPauseChange(); flow.flushReward();
  if (gate.paused) platform.setGameplayActive(false);
 });
 let prepared = false;
 let ready = false;
 // Like Cozy GameReady, wait until an interactive scene has actually rendered.
 const onRender = (): void => {
  if (ready || gate.has('sdk') || gate.has('browser') || gate.has('focus') || gate.has('input') || !scene?.scene.isActive()) return;
  if (!prepared) { prepared = true; scene.setReady(); return; }
  // Recheck external pause ownership on every frame, including a pause that
  // arrives between constructing the menu and rendering its enabled state.
  ready = true; platform.ready();
  game.events.off(Phaser.Core.Events.POST_RENDER, onRender);
 };
 game.events.on(Phaser.Core.Events.POST_RENDER, onRender);
 const destroy = (): void => {
  hideNavigationCover(); flow.dispose(); platform.setGameplayActive(false); manager.dispose(); configureAudioRuntime(null);
  detachInput(); inputGuard.dispose(); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
  detachGate(); detachLocale(); detachAudio(); detachBrowser(); detachSdkPause(); detachSdkResume();
  game.events.off(Phaser.Core.Events.POST_RENDER, onRender);
  if ('destroy' in platform && typeof platform.destroy === 'function') platform.destroy();
 };
 game.events.once(Phaser.Core.Events.DESTROY, destroy);
 return { game, model, gate, flow, locale, manager, scene, destroy: () => game.destroy(true) };
}

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
import { AdFlow } from './AdFlow';
import { WorkshopScene } from '../phaser/WorkshopScene';
import { computeRenderScale, selectStartupRenderScale, isDesktopBrowserUserAgent, LOGICAL_GAME_WIDTH, LOGICAL_GAME_HEIGHT } from '../phaser/Display';

export const afterFrame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
export async function boot(platformFactory = createPlatform) {
 // Initialize SDK and retain startup events before constructing Phaser/audio.
 const platform = await platformFactory();
 await document.fonts.load('700 24px Nunito').catch(() => {});
 return mountApplication(platform);
}
export function mountApplication(platform: PlatformService) {
 const gate = new PauseGate(); gate.set('startup', true); gate.set('sdk', platform.isPaused);
 let scene: WorkshopScene | undefined;
 const detachSdkPause = platform.onPause(() => gate.set('sdk', true));
 const detachSdkResume = platform.onResume(() => gate.set('sdk', false));
 const detachBrowser = attachBrowserGameplayLifecycle({ onBackground: () => gate.set('browser', true), onForeground: () => gate.set('browser', false) });
 const locale = new LocaleRuntime(platform.id === 'yandex' ? platform.locale : undefined);
 const translate = (): void => { document.documentElement.lang = locale.locale; document.title = locale.t('title'); scene?.invalidate(); };
 translate();
 const manager = new AudioManager(new HtmlAudioOutput(), new WebAudioSettingsStore());
 configureAudioRuntime(manager);
 const detachAudio = attachBrowserAudioLifecycle(manager);
 const audio = gameAudio(manager, () => {}); audio.setMuted(false);
 const model = createModel({ audio, canInteract: () => !gate.paused,
  onChange: () => scene?.invalidate(), onCombo: streak => scene?.showCombo(streak) });
 const campaign = new CampaignController(() => scene?.invalidate(), () => !gate.paused);
 const flow = new AdFlow<TrayOffer>({ gate, platform, interstitial: new InterstitialController(platform),
  cover: visible => scene?.setCover(visible), afterFrame,
  restart: () => model.commitRestart(), applyReward: offer => model.commitReward(offer) });
 const density = selectStartupRenderScale(computeRenderScale(window.devicePixelRatio || 1, window.innerWidth, window.innerHeight), isDesktopBrowserUserAgent(navigator.userAgent, navigator.maxTouchPoints));
 scene = new WorkshopScene({ model, campaign, gate, locale, manager, audio, platform, flow, density });
 const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'app', transparent: true, scene: [scene],
  audio: { noAudio: true }, // The shared Cozy audio lifecycle owns media and Web Audio.
  input: { activePointers: 2 },
  scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.NO_CENTER, expandParent: false,
   width: LOGICAL_GAME_WIDTH * density, height: LOGICAL_GAME_HEIGHT * density },
 });
 const detachLocale = locale.subscribe(translate);
 const detachGate = gate.subscribe(() => {
  // A modal pauses gameplay input, not background music or UI SFX.
  // Only external interruptions (SDK/browser/ad/transition) suspend audio.
  manager.setAdActive(shouldSuspendAudio(gate));
  scene?.onPauseChange(); flow.flushReward();
  if (gate.paused) platform.setGameplayActive(false);
 });
 let prepared = false;
 let ready = false;
 // Like Cozy GameReady, wait until an interactive scene has actually rendered.
 const onRender = (): void => {
  if (ready || gate.has('sdk') || gate.has('browser') || !scene?.scene.isActive()) return;
  if (!prepared) { prepared = true; scene.setReady(); return; }
  // Recheck external pause ownership on every frame, including a pause that
  // arrives between constructing the menu and rendering its enabled state.
  ready = true; platform.ready();
  game.events.off(Phaser.Core.Events.POST_RENDER, onRender);
 };
 game.events.on(Phaser.Core.Events.POST_RENDER, onRender);
 const destroy = (): void => {
  flow.dispose(); platform.setGameplayActive(false); manager.dispose(); configureAudioRuntime(null);
  detachGate(); detachLocale(); detachAudio(); detachBrowser(); detachSdkPause(); detachSdkResume();
  game.events.off(Phaser.Core.Events.POST_RENDER, onRender);
  if ('destroy' in platform && typeof platform.destroy === 'function') platform.destroy();
 };
 game.events.once(Phaser.Core.Events.DESTROY, destroy);
 return { game, model, gate, flow, locale, manager, scene, destroy: () => game.destroy(true) };
}

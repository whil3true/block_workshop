import { createGame, type GameApi, type TrayOffer } from '../game';
import { createDrag, type DragApi } from '../drag';
import { createViewportBinder, createDomMeasure } from '../viewport';
import { createPlatform } from '../platform/createPlatform';
import type { PlatformService } from '../platform/PlatformService';
import { InterstitialController } from '../platform/InterstitialController';
import { AudioManager } from '../audio/AudioManager';
import { HtmlAudioOutput } from '../audio/HtmlAudioOutput';
import { WebAudioSettingsStore } from '../platform/WebAudioSettingsStore';
import { attachBrowserAudioLifecycle } from '../audio/BrowserAudioLifecycle';
import { gameAudio } from '../audio/GameAudio';
import { attachBrowserGameplayLifecycle } from './BrowserGameplayLifecycle';
import { LocaleRuntime } from './LocaleRuntime';
import type { Word } from './Localization';
import { computeAppLayout } from './AppLayout';
import { PauseGate } from './PauseGate';
import { AdFlow } from './AdFlow';

export const afterFrame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
export async function boot(platformFactory = createPlatform, frame = afterFrame) {
 // Register the SDK listener owner before constructing game, UI or audio.
 const platform = await platformFactory();
 return mountApplication(platform, frame);
}
export function mountApplication(platform: PlatformService, frame = afterFrame) {
 const app = document.getElementById('app')!;
 const splash = document.getElementById('boot');
 const gate = new PauseGate();
 gate.set('startup', true);
 gate.set('sdk', platform.isPaused);
 const detachSdkPause = platform.onPause(() => gate.set('sdk', true));
 const detachSdkResume = platform.onResume(() => gate.set('sdk', false));
 const detachBrowser = attachBrowserGameplayLifecycle({ onBackground: () => gate.set('browser', true), onForeground: () => gate.set('browser', false) });
 const locale = new LocaleRuntime(platform.locale);
 const manager = new AudioManager(new HtmlAudioOutput(), new WebAudioSettingsStore());
 const detachAudio = attachBrowserAudioLifecycle(manager);
 let muted = false;
 const audio = gameAudio(manager, value => { muted = value; manager.setAdActive(value || gate.paused); });
 // The legacy global-mute control is retired; keep saved music/effects volumes.
 audio.setMuted(false);
 let game: GameApi | undefined;
 let drag: DragApi | undefined;
 let flow: AdFlow<TrayOffer> | undefined;
 let started = false;
 let destroyed = false;
 let modal: HTMLElement | null = null;
 let previousFocus: HTMLElement | null = null;
 let offering: TrayOffer | null = null;
 let ready = false;
 let revealing = false;
 let notice = '';
 const cover = document.createElement('div'); cover.className = 'navigation-cover'; cover.hidden = true;
 const paused = document.createElement('div'); paused.className = 'pause-cover'; paused.hidden = true;
 const start = document.createElement('section'); start.className = 'welcome';
 const brand = document.createElement('h1'); brand.dataset['word'] = 'title';
 const rules = document.createElement('p'); rules.dataset['word'] = 'rules';
 const play = button('play', () => {
  if (gate.has('sdk') || gate.has('browser') || !ready) return;
  audio.unlock(); started = true; start.hidden = true; gate.set('startup', false);
  try { localStorage.setItem('block-workshop:tutorial-seen', 'true'); } catch { /* session works */ }
  sync();
 });
 const welcomeSettings = button('settings', () => settings());
 try { rules.hidden = localStorage.getItem('block-workshop:tutorial-seen') === 'true'; } catch { /* show tutorial */ }
 start.append(brand, rules, play, welcomeSettings);
 game = createGame({ audio, canInteract: () => !gate.paused, onRestart: () => confirmRestart(), onChange: () => sync() });
 game.mount(app);
 if (game.score > 0) play.dataset['word'] = 'resume';
 const hud = app.querySelector<HTMLElement>('.hud')!;
 const top = document.createElement('div'); top.className = 'appbar';
 const name = document.createElement('strong'); name.dataset['word'] = 'title';
 const controls = document.createElement('div'); controls.className = 'appbar__controls';
 controls.append(button('settings', () => settings()), button('menu', () => returnToMenu()));
 top.append(name, controls); hud.prepend(top);
 const actions = document.createElement('div'); actions.className = 'actions';
 const restartButton = button('newGame', () => confirmRestart());
 const rewardButton = button('reward', () => confirmReward());
 actions.append(restartButton, rewardButton); hud.append(actions);
 const label = document.createElement('small'); label.className = 'preview-label';
 if (platform.id === 'web') label.dataset['word'] = 'standalone';
 hud.append(label);
 const overReward = button('reward', () => confirmReward()); app.querySelector('.overlay')!.append(overReward);
 const overMenu = button('menu', () => returnToMenu()); app.querySelector('.overlay')!.append(overMenu);
 app.append(start, paused, cover);
 const binder = createViewportBinder({ layout: computeAppLayout, appEl: app, root: document.documentElement, measure: createDomMeasure({ appEl: app, hudEl: hud, root: document.documentElement }) });
 drag = createDrag(game, app.querySelector('.tray')!, app.querySelector('.board')!, audio, () => !gate.paused);
 flow = new AdFlow({ gate, platform, interstitial: new InterstitialController(platform), cover: visible => { cover.hidden = !visible; }, afterFrame: frame,
  restart: () => game!.commitRestart(), applyReward: offer => game!.commitReward(offer) });
 const detachGate = gate.subscribe(() => {
  if (gate.paused) drag?.cancel();
  game?.setPresentationPaused(gate.paused);
  manager.setAdActive(muted || gate.paused);
  flow?.flushReward();
  sync();
  void reveal();
 });
 const detachLocale = locale.subscribe(() => { translate(); binder.apply(); });
 function translate(): void {
  document.documentElement.lang = locale.locale; document.title = locale.t('title');
  for (const el of app.querySelectorAll<HTMLElement>('[data-word]')) el.textContent = locale.t(el.dataset['word'] as Word);
  const current = hud.querySelector('.hud__pair--current .hud__label'); if (current) current.textContent = locale.t('score');
  const best = hud.querySelector('.hud__pair--best .hud__label'); if (best) best.textContent = locale.t('best');
  const heading = app.querySelector('.overlay__heading'); if (heading) heading.textContent = locale.t('gameOver');
  const reset = app.querySelector('.overlay__button'); if (reset) reset.textContent = locale.t('newGame');
  paused.textContent = locale.t('paused');
  const combo = app.querySelector<HTMLElement>('.combo-callout');
  if (combo?.textContent) combo.textContent = combo.textContent.replace(/^[^×]*/, locale.t('combo') + ' ');
  for (const el of app.querySelectorAll<HTMLElement>('[data-label-word]')) el.setAttribute('aria-label', locale.t(el.dataset['labelWord'] as Word));
 }
 function sync(): void {
  if (!game || destroyed) return;
  app.dataset['paused'] = String(gate.paused);
  // The cover blocks all UI while the SDK/browser owns a pause. Settings owns its own dialog.
  paused.hidden = !(gate.has('sdk') || gate.has('browser')) || !started;
  platform.setGameplayActive(started && !game.gameOver && !gate.paused);
  const busy = gate.paused || (flow?.busy ?? false);
  const possible = game.canReward;
  for (const el of [rewardButton, overReward]) { el.disabled = busy || !possible || platform.id !== 'yandex'; el.hidden = game.rewardUsed || !possible; }
  restartButton.disabled = busy;
  if (typeof hud !== 'undefined') translate();
 }
 function button(word: Word, action: () => void): HTMLButtonElement {
  const b = document.createElement('button'); b.type = 'button'; b.dataset['word'] = word; b.textContent = locale.t(word);
  b.addEventListener('click', () => {
   if (gate.has('sdk') || gate.has('browser') || gate.has('ad') || gate.has('transition')) return;
   action();
  }); return b;
 }
 function returnToMenu(): void {
  if (!started || gate.paused || flow?.busy) return;
  started = false;
  gate.set('startup', true);
  start.hidden = false;
  play.dataset['word'] = game && game.score > 0 && !game.gameOver ? 'resume' : 'play';
  translate(); sync(); play.focus();
 }
 function closeModal(): void {
  modal?.remove(); modal = null; gate.set('manual', false); previousFocus?.focus(); previousFocus = null;
 }
 function openModal(title: Word): HTMLElement | null {
  // The menu is intentionally paused by startup; its Settings must still open.
  const menuOnly = !started && gate.has('startup') && !gate.has('manual') && !gate.has('sdk') && !gate.has('browser') && !gate.has('ad') && !gate.has('transition');
  if ((gate.paused && !menuOnly) || flow?.busy) return null;
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  gate.set('manual', true);
  modal = document.createElement('section'); modal.className = 'modal'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
  const panel = document.createElement('div'); panel.className = 'modal__panel';
  const h = document.createElement('h2'); h.dataset['word'] = title; h.id = 'dialog-title'; h.textContent = locale.t(title); modal.setAttribute('aria-labelledby', h.id);
  panel.append(h); modal.append(panel); app.append(modal); return panel;
 }
 function confirmRestart(): void {
  const panel = openModal('newGame'); if (!panel) return;
  const text = document.createElement('p'); text.dataset['word'] = 'restartConfirm'; text.textContent = locale.t('restartConfirm');
  panel.append(text, button('yes', () => { closeModal(); void flow!.restart(); }), button('no', closeModal));
  panel.querySelector<HTMLButtonElement>('button')?.focus();
 }
 function confirmReward(): void {
  if (platform.id !== 'yandex' || !game) return;
  offering = game.prepareReward(); if (!offering) return;
  const panel = openModal('reward'); if (!panel) return;
  const text = document.createElement('p'); text.dataset['word'] = 'rewardConfirm'; text.textContent = locale.t('rewardConfirm');
  panel.append(text, button('yes', () => {
   const offer = offering; offering = null; closeModal();
   if (offer) void flow!.reward(offer).then(granted => { if (!granted) { notice = locale.t('rewardUnavailable'); showNotice(); } });
  }), button('no', closeModal));
  panel.querySelector<HTMLButtonElement>('button')?.focus();
 }
 function showNotice(): void {
  const el = document.createElement('p'); el.className = 'toast'; el.setAttribute('role','status'); el.textContent = notice; app.append(el);
  setTimeout(() => el.remove(), 4000);
 }
 function settings(): void {
  const panel = openModal('settings'); if (!panel) return;
  for (const [word, value, set] of [
   ['music', manager.getSettings().musicVolume, (v: number) => manager.setMusicVolume(v)],
   ['effects', manager.getSettings().sfxVolume, (v: number) => manager.setSfxVolume(v)],
  ] as const) {
   const row = document.createElement('label'); const text = document.createElement('span'); text.dataset['word'] = word; text.textContent = locale.t(word);
   const slider = document.createElement('input'); slider.type = 'range'; slider.min='0'; slider.max='100'; slider.value=String(Math.round(value*100)); slider.setAttribute('aria-label',locale.t(word)); slider.dataset['labelWord']=word;
   slider.addEventListener('input', () => set(Number(slider.value)/100)); row.append(text,slider); panel.append(row);
  }
  const languages = document.createElement('div'); languages.className='actions';
  for (const lang of ['ru','en'] as const) { const b = document.createElement('button'); b.textContent=lang.toUpperCase(); b.type='button'; b.addEventListener('click', () => locale.set(lang)); languages.append(b); }
  const how = document.createElement('p'); how.dataset['word']='rules'; how.textContent=locale.t('rules');
  panel.append(languages, how, button('close', closeModal)); panel.querySelector<HTMLInputElement>('input')?.focus();
 }
 const keyboard = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && modal && !gate.has('sdk') && !gate.has('browser')) closeModal();
  if (event.key !== 'Tab' || !modal) return;
  const targets = Array.from(modal.querySelectorAll<HTMLElement>('button, input'));
  const first = targets[0], last = targets.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
 };
 document.addEventListener('keydown', keyboard);
 async function reveal(): Promise<void> {
  if (ready || revealing || destroyed || gate.has('sdk') || gate.has('browser')) return;
  revealing = true;
  app.hidden = false; translate(); binder.apply();
  await frame();
  revealing = false;
  if (destroyed || gate.has('sdk') || gate.has('browser')) return;
  ready = true; splash?.remove(); platform.ready(); play.focus();
 }
 // Browser events own all live consumers before the first interactive frame.
 app.hidden = false; translate(); binder.apply(); sync(); void reveal();
 return { game, gate, flow, locale, manager, destroy: () => {
  destroyed = true; flow?.dispose(); platform.setGameplayActive(false); drag?.destroy(); binder.destroy(); manager.dispose();
  detachGate(); detachLocale(); detachAudio(); detachBrowser(); detachSdkPause(); detachSdkResume(); document.removeEventListener('keydown', keyboard); app.replaceChildren();
 } };
}

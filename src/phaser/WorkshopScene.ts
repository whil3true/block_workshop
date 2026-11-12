import Phaser from 'phaser';
import { canPlace } from '../engine';
import type { Piece } from '../pieces';
import type { ModelApi, TrayOffer } from '../model';
import type { AudioApi } from '../audio';
import type { AudioManager } from '../audio/AudioManager';
import type { PlatformService } from '../platform/PlatformService';
import type { PauseGate } from '../app/PauseGate';
import type { AdFlow } from '../app/AdFlow';
import type { LocaleRuntime } from '../app/LocaleRuntime';
import type { Word } from '../app/Localization';
import { configureLogicalCamera } from './Display';
import { createPrimaryButton, createSecondaryButton, createUiText, createViewportBackdrop, createModalShell } from './UiPrimitives';
import { createAudioVolumeSlider } from './AudioVolumeSlider';
import { BOARD, TRAY, PIECE_COLORS, boardAnchor } from './BoardGeometry';

type Modal = 'settings' | 'restart' | 'reward' | null;
export interface SceneServices {
 model: ModelApi; gate: PauseGate; locale: LocaleRuntime; manager: AudioManager; audio: AudioApi;
 platform: PlatformService; flow: AdFlow<TrayOffer>; density: number;
}
interface ActiveDrag { pointerId: number; slot: number; piece: Piece; lift: number; x: number; y: number; }
/** One scene owns screens and overlays; services and the pure model outlive navigation. */
export class WorkshopScene extends Phaser.Scene {
 private root!: Phaser.GameObjects.Container;
 private preview!: Phaser.GameObjects.Graphics;
 private ghost!: Phaser.GameObjects.Graphics;
 private dirty = true;
 private disposed = false;
 private started = false;
 private modal: Modal = null;
 private ready = false;
 private cover = false;
 private drag: ActiveDrag | null = null;
 private offering: TrayOffer | null = null;
 private notice = false;
 private noticeUntil = 0;
 private combo = 0;
 private comboRemaining = 0;
 constructor(private readonly services: SceneServices) { super('WorkshopScene'); }
 create(): void {
  this.disposed = false;
  this.events.once(Phaser.Scenes.Events.DESTROY, () => { this.disposed = true; });
  configureLogicalCamera(this, this.services.density);
  this.root = this.add.container(0, 0);
  this.preview = this.add.graphics().setDepth(10);
  this.ghost = this.add.graphics().setDepth(11);
  this.input.on('pointermove', this.move, this);
  this.input.on('pointerup', this.release, this);
  this.input.on('pointerupoutside', this.cancelDrag, this);
  this.input.on('gameout', this.cancelDrag, this);
  this.input.keyboard?.on('keydown-ESC', () => {
   if (!this.externalBlock() && this.modal) this.closeModal();
  });
  const cancel = (): void => this.cancelDrag();
  this.game.canvas.addEventListener('pointercancel', cancel);
  const resize = (): void => { this.cancelDrag(); this.invalidate(); };
  this.scale.on(Phaser.Scale.Events.RESIZE, resize);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
   this.disposed = true;
   this.game.canvas.removeEventListener('pointercancel', cancel);
   this.scale.off(Phaser.Scale.Events.RESIZE, resize);
  });
  this.draw();
 }
 invalidate(): void { this.dirty = true; }
 setReady(): void { this.ready = true; this.invalidate(); }
 setCover(visible: boolean): void { this.cover = visible; this.invalidate(); }
 showCombo(streak: number): void { this.combo = streak; this.comboRemaining = 900; this.invalidate(); }
 onPauseChange(): void {
  if (this.services.gate.paused) this.cancelDrag();
  this.invalidate();
 }
 update(_time: number, delta: number): void {
  if (this.comboRemaining > 0 && !this.services.gate.paused) {
   this.comboRemaining -= delta;
   if (this.comboRemaining <= 0) this.invalidate();
  }
  if (this.notice && performance.now() >= this.noticeUntil) { this.notice = false; this.invalidate(); }
  if (this.dirty) this.draw();
 }
 private externalBlock(): boolean {
  const gate = this.services.gate;
  return !this.ready || gate.has('sdk') || gate.has('browser') || gate.has('ad') || gate.has('transition');
 }
 private text(x: number, y: number, value: string, role: 'screenTitle' | 'body' | 'hudPrimary' | 'caption' = 'body', width = 0): Phaser.GameObjects.Text {
  const text = createUiText(this, this.services.density, x, y, value, role, { align: 'center' }).setOrigin(0.5);
  if (width) text.setWordWrapWidth(width, true);
  this.root.add(text); return text;
 }
 private button(key: string, word: Word | 'RU' | 'EN', x: number, y: number, action: () => void, width = 200, disabled = false, primary = false): void {
  const button = (primary ? createPrimaryButton : createSecondaryButton)(this, this.services.density, {
   x, y, width, height: 50, label: word === 'RU' || word === 'EN' ? word : this.services.locale.t(word),
   disabled: disabled || this.externalBlock(), onActivate: () => { if (!this.externalBlock()) action(); },
  });
  button.container.setName(key); this.root.add(button.container);
 }
 private overlay(): void {
  this.root.add(createViewportBackdrop(this, 0x0f172a, 0.94).setInteractive());
 }
 private draw(): void {
  this.dirty = false;
  this.root.removeAll(true);
  this.root.add(createViewportBackdrop(this, 0x0f172a));
  const { model, locale, gate, platform } = this.services;
  if (!this.started) {
   this.text(240, 215, locale.t('title'), 'screenTitle', 430);
   this.text(240, 330, locale.t('rules'), 'body', 400);
   this.text(240, 432, `${locale.t('best')}: ${model.bestScore}`, 'hudPrimary');
   this.button('play', !model.gameOver && model.score > 0 ? 'resume' : 'play', 240, 510, () => {
    if (model.gameOver) model.commitRestart();
    this.started = true; gate.set('startup', false); this.services.audio.unlock(); this.invalidate();
   }, 300, false, true);
   this.button('menu-settings', 'settings', 240, 578, () => this.openModal('settings'), 300);
  } else {
   this.text(240, 27, locale.t('title'), 'hudPrimary', 450);
   this.button('settings', 'settings', 117, 76, () => this.openModal('settings'), 210);
   this.button('menu', 'menu', 363, 76, () => this.toMenu(), 210);
   const score = this.text(130, 127, `${locale.t('score')}: ${model.score}`, 'hudPrimary');
   const best = this.text(355, 127, `${locale.t('best')}: ${model.bestScore}`, 'hudPrimary');
   for (const label of [score, best]) if (label.width > 210) label.setScale(210 / label.width);
   const graphics = this.add.graphics(); this.root.add(graphics);
   graphics.fillStyle(0x1e293b).fillRoundedRect(14, 150, 452, 452, 8);
   for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    const family = model.boardState[r]![c];
    graphics.fillStyle(family ? PIECE_COLORS[family] : 0x334155)
     .fillRoundedRect(BOARD.x + c * BOARD.cell + 1, BOARD.y + r * BOARD.cell + 1, BOARD.cell - 2, BOARD.cell - 2, 4);
   }
   if (this.comboRemaining > 0) this.text(240, 612, `${locale.t('combo')} ×${this.combo}`, 'hudPrimary');
   model.trayPieces.forEach((piece, slot) => {
    if (!piece) return;
    const x = TRAY.centers[slot]!;
    this.drawPiece(graphics, piece, x - piece.bbox.w * TRAY.cell / 2, TRAY.y - piece.bbox.h * TRAY.cell / 2, TRAY.cell);
    const zone = this.add.zone(x, TRAY.y, TRAY.hitWidth, TRAY.hitHeight).setName(`tray-${slot}`).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.pickup(pointer, slot, piece));
    this.root.add(zone);
   });
   this.button('restart', 'newGame', 130, 759, () => this.openModal('restart'), 220);
   if (!model.rewardUsed && model.canReward) this.button('reward', 'reward', 360, 759, () => this.openModal('reward'), 220, platform.id !== 'yandex');
   if (model.gameOver) {
    this.overlay();
    this.text(240, 270, locale.t('gameOver'), 'screenTitle', 420);
    this.text(240, 327, `${locale.t('score')}: ${model.score}`, 'hudPrimary');
    this.button('over-restart', 'newGame', 240, 400, () => this.openModal('restart'), 320, false, true);
    if (!model.rewardUsed && model.canReward) this.button('over-reward', 'reward', 240, 467, () => this.openModal('reward'), 320, platform.id !== 'yandex');
    this.button('over-menu', 'menu', 240, 534, () => this.toMenu(), 320);
   }
  }
  if (this.modal) this.drawModal();
  if (this.notice) this.text(240, 617, locale.t('rewardUnavailable'), 'caption', 410);
  if (this.cover || this.externalBlock()) {
   this.overlay();
   this.text(240, 400, locale.t(this.ready ? 'paused' : 'loading'), 'screenTitle');
  }
  platform.setGameplayActive(this.started && !model.gameOver && !gate.paused && this.ready);
 }
 private toMenu(): void {
  if (this.services.gate.paused || this.services.flow.busy) return;
  this.cancelDrag(); this.started = false; this.services.gate.set('startup', true); this.invalidate();
 }
 private openModal(modal: Exclude<Modal, null>): void {
  if (this.modal || this.externalBlock() || this.services.flow.busy) return;
  if (modal === 'reward') {
   if (this.services.platform.id !== 'yandex') return;
   this.offering = this.services.model.prepareReward(); if (!this.offering) return;
  }
  this.cancelDrag(); this.modal = modal; this.services.gate.set('manual', true); this.invalidate();
 }
 private closeModal(): void {
  this.modal = null; this.offering = null; this.services.gate.set('manual', false); this.invalidate();
 }
 private drawModal(): void {
  const { locale, manager } = this.services;
  this.root.add(createModalShell(this, { x: 240, y: 400, width: 440, height: this.modal === 'settings' ? 640 : 360 }));
  if (this.modal === 'settings') {
   this.text(240, 124, locale.t('settings'), 'screenTitle');
   this.text(240, 178, locale.t('language'));
   this.button('language-ru', 'RU', 150, 230, () => this.services.locale.set('ru'), 150);
   this.button('language-en', 'EN', 330, 230, () => this.services.locale.set('en'), 150);
   for (const [word, y, value, set] of [
    ['music', 326, manager.getSettings().musicVolume, (v: number) => manager.setMusicVolume(v)],
    ['effects', 426, manager.getSettings().sfxVolume, (v: number) => manager.setSfxVolume(v)],
   ] as const) {
    const slider = createAudioVolumeSlider(this, this.services.density, { x: 240, y, width: 360, label: locale.t(word), value, onChange: set });
    slider.setName(`slider-${word}`); this.root.add(slider);
   }
   this.text(240, 557, locale.t('rules'), 'caption', 380);
   this.button('close-settings', 'close', 240, 667, () => this.closeModal(), 320);
  } else {
   const restart = this.modal === 'restart';
   this.text(240, 273, locale.t(restart ? 'newGame' : 'reward'), 'screenTitle', 400);
   this.text(240, 359, locale.t(restart ? 'restartConfirm' : 'rewardConfirm'), 'body', 380);
   this.button('confirm', 'yes', 240, 450, () => {
    const offer = this.offering; this.closeModal();
    if (restart) { this.comboRemaining = 0; void this.services.flow.restart(); }
    else if (offer) void this.services.flow.reward(offer).then(granted => {
     if (this.disposed || !this.scene.isActive()) return;
     if (!granted) { this.notice = true; this.noticeUntil = performance.now() + 4000; } this.invalidate();
    });
   }, 320, false, true);
   this.button('cancel', 'no', 240, 518, () => this.closeModal(), 320);
  }
 }
 private drawPiece(graphics: Phaser.GameObjects.Graphics, piece: Piece, x: number, y: number, cell: number, alpha = 1): void {
  graphics.fillStyle(PIECE_COLORS[piece.family], alpha);
  for (const [r, c] of piece.cells) graphics.fillRoundedRect(x + c * cell + 1, y + r * cell + 1, cell - 2, cell - 2, 4);
 }
 private pickup(pointer: Phaser.Input.Pointer, slot: number, piece: Piece): void {
  if (this.drag || this.services.gate.paused || this.services.model.gameOver || this.externalBlock()) return;
  this.drag = { pointerId: pointer.id, slot, piece, lift: pointer.wasTouch ? 40 : 0, x: 0, y: 0 };
  this.services.audio.pickup(); this.move(pointer);
 }
 private move(pointer: Phaser.Input.Pointer): void {
  const drag = this.drag; if (!drag || pointer.id !== drag.pointerId) return;
  if (this.services.gate.paused) { this.cancelDrag(); return; }
  const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  drag.x = world.x; drag.y = world.y - drag.lift;
  this.ghost.clear(); this.preview.clear();
  this.drawPiece(this.ghost, drag.piece, drag.x - BOARD.cell / 2, drag.y - BOARD.cell / 2, BOARD.cell, 0.85);
  const anchor = boardAnchor(drag.x, drag.y); if (!anchor) return;
  const valid = canPlace(this.services.model.boardState, drag.piece, anchor.row, anchor.col);
  this.preview.fillStyle(valid ? 0x4ade80 : 0xf43f5e, 0.5);
  for (const [r, c] of drag.piece.cells) {
   const row = anchor.row + r, col = anchor.col + c;
   if (row < 10 && col < 10) this.preview.fillRoundedRect(BOARD.x + col * BOARD.cell + 1, BOARD.y + row * BOARD.cell + 1, 42, 42, 4);
  }
 }
 private release(pointer: Phaser.Input.Pointer): void {
  const drag = this.drag; if (!drag || pointer.id !== drag.pointerId) return;
  this.move(pointer);
  const anchor = boardAnchor(drag.x, drag.y);
  this.cancelDrag();
  if (!this.services.gate.paused && anchor && canPlace(this.services.model.boardState, drag.piece, anchor.row, anchor.col)) {
   this.services.model.place(drag.slot, anchor.row, anchor.col);
  } else this.services.audio.reject();
 }
 cancelDrag(): void { this.drag = null; this.ghost?.clear(); this.preview?.clear(); }
}

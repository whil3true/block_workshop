import Phaser from 'phaser';
import { canPlace, type BoardState } from '../engine';
import type { Piece, PieceFamily } from '../pieces';
import { findPieceById } from '../pieces';
import type { ModelApi, TrayOffer } from '../model';
import type { AudioApi } from '../audio';
import type { AudioManager } from '../audio/AudioManager';
import type { PlatformService } from '../platform/PlatformService';
import type { PauseGate } from '../app/PauseGate';
import type { AdFlow } from '../app/AdFlow';
import type { LocaleRuntime } from '../app/LocaleRuntime';
import type { Word } from '../app/Localization';
import type { CampaignController } from '../campaign/CampaignSession';
import { CAMPAIGN_CATALOG, CHAPTERS, findOrder, isOrderUnlocked } from '../campaign/CampaignCatalog';
import { fragmentProgress, orderProgress, type TargetFragment } from '../campaign/OrderRules';
import { configureLogicalCamera } from './Display';
import { createPrimaryButton, createSecondaryButton, createUiText, createViewportBackdrop, createModalShell } from './UiPrimitives';
import { createAudioVolumeSlider } from './AudioVolumeSlider';
import { BOARD, TRAY, PIECE_COLORS, TILE_MATERIAL, boardAnchor } from './BoardGeometry';
import { preloadCozyAssets, paperSurface, syncViewportPaper } from './CozyAssets';

type Modal = 'settings' | 'restart' | 'reward' | 'goal' | 'campaignNotice' | null;
export interface SceneServices {
 model: ModelApi; campaign: CampaignController; gate: PauseGate; locale: LocaleRuntime; manager: AudioManager; audio: AudioApi;
 platform: PlatformService; flow: AdFlow<TrayOffer>; density: number;
}
interface ActiveDrag { pointerId: number; slot: number; piece: Piece; lift: number; x: number; y: number; }
/** Screens share exactly one SDK, audio owner, PauseGate and ad transaction controller. */
export class WorkshopScene extends Phaser.Scene {
 private root!: Phaser.GameObjects.Container;
 private preview!: Phaser.GameObjects.Graphics;
 private ghost!: Phaser.GameObjects.Container;
 private effects!: Phaser.GameObjects.Container;
 private dirty = true;
 private disposed = false;
 private screen: 'menu' | 'journal' | 'play' = 'menu';
 private mode: 'classic' | 'campaign' = 'classic';
 private chapter = 1;
 private modal: Modal = null;
 private ready = false;
 private selectedFragment: string | null = null;
 private cover = false;
 private drag: ActiveDrag | null = null;
 private offering: TrayOffer | null = null;
 private noticeUntil = 0;
 private combo = 0;
 private comboRemaining = 0;
 constructor(private readonly services: SceneServices) { super('WorkshopScene'); }
 preload(): void { preloadCozyAssets(this); }
 create(): void {
  this.disposed = false;
  this.events.once(Phaser.Scenes.Events.DESTROY, () => { this.disposed = true; });
  this.game.canvas.setAttribute('aria-busy','true');
  this.game.canvas.setAttribute('aria-label',this.services.locale.t('title'));
  configureLogicalCamera(this, this.services.density);
  syncViewportPaper(this);
  // Crop only transparent padding; the button and its hit-area stay at (49,45).
  const back = this.textures.exists('cozy-back') ? this.textures.get('cozy-back') : null;
  if (back && !back.has('centered')) back.add('centered',0,39,24,70,81);
  this.root = this.add.container(0, 0);
  this.preview = this.add.graphics().setDepth(10);
  this.ghost = this.add.container(0,0).setDepth(11);
  this.effects = this.add.container(0,0).setDepth(12);
  this.input.on('pointermove', this.move, this);
  this.input.on('pointerup', this.release, this);
  this.input.on('pointerupoutside', this.cancelDrag, this);
  this.input.on('gameout', this.cancelDrag, this);
  this.input.keyboard?.on('keydown-ESC', () => {
   if (this.externalBlock()) return;
   if (this.modal) this.closeModal(); else if (this.screen !== 'menu') this.navigate('menu');
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
 setReady(): void { this.game.canvas.setAttribute('aria-busy','false'); this.ready = true; this.invalidate(); }
 setCover(visible: boolean): void { this.cover = visible; this.invalidate(); }
 showCombo(streak: number): void { this.combo = streak; this.comboRemaining = 900; this.invalidate(); }
 onPauseChange(): void { if (this.services.gate.paused) this.cancelDrag(); this.invalidate(); }
 update(_time: number, delta: number): void {
  if (this.comboRemaining > 0 && !this.services.gate.paused) {
   this.comboRemaining -= delta; if (this.comboRemaining <= 0) this.invalidate();
  }
  if (this.noticeUntil > 0 && performance.now() >= this.noticeUntil) { this.noticeUntil = 0; this.invalidate(); }
  if (this.dirty) this.draw();
 }
 private externalBlock(): boolean {
  const gate = this.services.gate;
  return !this.ready || gate.has('sdk') || gate.has('browser') || gate.has('ad') || gate.has('transition');
 }
 private get board(): BoardState { return this.mode === 'campaign' ? this.services.campaign.active!.board : this.services.model.boardState; }
 private get pieces(): readonly (Piece | null)[] {
  return this.mode === 'campaign' ? this.services.campaign.active!.trayIds.map(id => id ? findPieceById(id) ?? null : null) : this.services.model.trayPieces;
 }
 private get terminal(): boolean { return this.mode === 'campaign' ? this.services.campaign.active?.status !== 'running' : this.services.model.gameOver; }
 private text(x: number, y: number, value: string, role: 'screenTitle' | 'body' | 'hudPrimary' | 'caption' = 'body', width = 0, color?: string): Phaser.GameObjects.Text {
  const text = createUiText(this, this.services.density, x, y, value, role, color ? { align: 'center', color } : { align: 'center' }).setOrigin(0.5);
  if (width) text.setWordWrapWidth(width, true);
  this.root.add(text); return text;
 }
 private surface(key: string, x: number, y: number, w: number, h: number, fallback = 0xfff8f1): void { this.root.add(paperSurface(this,key,x,y,w,h,fallback)); }
 private icon(key: string, x: number, y: number, size = 32, fallback = ''): void {
  if (this.textures.exists(`cozy-${key}`)) {
   const image = this.add.image(x,y,`cozy-${key}`,key === 'back' ? 'centered' : undefined);
   image.setDisplaySize(key === 'back' ? size*70/81 : size,size);
   // Optical adjustment of the cropped glyph only; keep the surface and hit-area fixed.
   if (key === 'back') image.x -= 1;
   this.root.add(image);
  }
  else if (fallback) this.text(x,y,fallback,'body');
 }
 private button(key: string, word: Word | 'RU' | 'EN', x: number, y: number, action: () => void, width = 200, disabled = false, primary = false): void {
  const button = (primary ? createPrimaryButton : createSecondaryButton)(this, this.services.density, {
   x, y, width, height: 56, label: word === 'RU' || word === 'EN' ? word : this.services.locale.t(word),
   disabled: disabled || this.externalBlock(), onActivate: () => { if (!this.externalBlock()) action(); },
  });
  button.container.setName(key); this.root.add(button.container);
 }
 private zone(key: string,x: number,y: number,w: number,h: number,action: () => void, disabled = false): void {
  const zone = this.add.zone(x,y,w,h).setName(key);
  if (!disabled && !this.externalBlock()) zone.setInteractive({useHandCursor:true}).on('pointerdown', () => {
   if (!this.externalBlock() && !this.modal) { this.services.audio.unlock(); action(); }
  });
  this.root.add(zone);
 }
 private header(title: string, back: () => void): void {
  this.surface('button-secondary',49,45,64,62); this.icon('back',49,45,30,'‹');
  this.zone('nav-back',49,45,66,66,back);
  this.text(240,45,title,'hudPrimary',300);
  this.surface('button-secondary',431,45,64,62); this.icon('settings',431,45,30,'⚙');
  this.zone('nav-settings',431,45,66,66,() => this.openModal('settings'));
 }
 private overlay(): void { this.root.add(createViewportBackdrop(this,0x4e4038,0.55).setInteractive()); }
 private draw(): void {
  this.dirty = false; this.root.removeAll(true);
  if (this.screen === 'menu') this.drawMenu();
  else if (this.screen === 'journal') this.drawJournal();
  else this.drawPlay();
  if (this.modal) this.drawModal();
  if (this.noticeUntil > 0) this.text(240,617,this.services.locale.t('rewardUnavailable'),'caption',410);
  if (this.cover || this.externalBlock()) { this.overlay(); this.text(240,400,this.services.locale.t(this.ready ? 'paused' : 'loading'),'screenTitle'); }
  this.services.platform.setGameplayActive(this.screen === 'play' && !this.terminal && !this.services.gate.paused && this.ready);
 }
 private drawMenu(): void {
  const { locale, model, campaign } = this.services;
  if (this.textures.exists('cozy-mosaic-flower')) this.root.add(this.add.image(240,150,'cozy-mosaic-flower').setDisplaySize(230,176));
  else { this.surface('tile-sage',215,130,62,62,0x9cab86); this.surface('tile-apricot',266,174,62,62,0xdeaa8b); }
  this.text(240,274,locale.t('title'),'screenTitle',440).setFontSize(36);
  this.text(240,315,locale.t('studio'),'caption',430,'#7A6A60');
  const modeCard = (key: string, y: number, icon: string, title: Word, subtitle: string, resume: boolean, action: () => void): void => {
   this.surface(key === 'orders' ? 'order-card' : 'journal-card',240,y,416,144);
   this.icon(icon,82,y,46,key === 'orders' ? '▤' : '▷');
   // Center the copy on the card, independently of the decorative left icon.
   this.text(240,y-39,locale.t(title),'screenTitle',252);
   this.text(240,y+1,subtitle,'caption',252,'#7A6A60');
   this.text(240,y+39,locale.t(resume ? 'resume' : 'play'),'body',252,'#98513F');
   this.zone(key,240,y,416,144,action);
  };
  modeCard('orders',412,'book','orders',`${locale.t('chapter')} ${this.chapter} · ${campaign.completed.length}/${CAMPAIGN_CATALOG.length}`,campaign.active?.status === 'running',() => this.navigate('journal'));
  modeCard('play',580,'play','classic',`${locale.t('best')}: ${this.formatScore(model.bestScore)}`,!model.gameOver && model.score > 0,() => {
   if (model.gameOver) model.commitRestart();
   this.mode = 'classic'; this.services.audio.unlock(); this.navigate('play');
  });
  this.button('menu-settings','settings',240,690,() => this.openModal('settings'),300);
 }
 private drawJournal(): void {
  const { locale, campaign } = this.services;
  this.header(locale.t('orders'),() => this.navigate('menu'));
  const chapter = CHAPTERS[this.chapter-1]!;
  const orders = CAMPAIGN_CATALOG.filter(o => chapter.orderIds.includes(o.id));
  this.text(240,112,`${locale.t('chapter')} ${chapter.number} · ${chapter.title[locale.locale]}`,'screenTitle',440);
  CHAPTERS.forEach((entry,i) => {
   const x = [86,252,399][i]!;
   if (entry.orderIds.length) {
    this.surface('chapter-tab',x,174,120,50,0x9cab86);this.text(x,174,`${entry.number} / 3`,'body');
    this.zone(`chapter-${entry.number}`,x,174,120,60,() => {this.chapter=entry.number;this.invalidate();});
   } else this.text(x,174,`${entry.number} · ${locale.t('soon')}`,'caption',140,'#7A6A60');
  });
  const columns = orders.length > 3 ? 2 : 1;
  orders.forEach((order,index) => {
   const y = 278 + Math.floor(index/columns) * 135, x = columns === 1 ? 240 : index%2 === 0 ? 128 : 352;
   const cardWidth = columns === 1 ? 416 : 208, textX = columns === 1 ? 281 : x, textWidth = columns === 1 ? 290 : 184;
   const complete = campaign.completed.includes(order.id), unlocked = isOrderUnlocked(order.id,campaign.completed);
   this.surface('journal-card',x,y,cardWidth,120,unlocked ? 0xfff8f1 : 0xefe4d6);
   if (columns === 1) this.text(82,y-12,String(CAMPAIGN_CATALOG.indexOf(order)+1).padStart(2,'0'),'screenTitle');
   this.icon(complete ? 'check' : unlocked ? 'play' : 'lock',columns === 1 ? 82 : x-74,y+26,28,complete ? '✓' : unlocked ? '›' : '•');
   this.text(textX,y-29,order.title[locale.locale],'body',textWidth);
   this.text(textX,y+6,locale.t(complete ? 'completed' : unlocked ? 'available' : 'locked'),'caption',textWidth,complete ? '#5B704D' : '#7A6A60');
   const current = campaign.active?.orderId === order.id ? campaign.active : null;
   const progress = current ? `${locale.t('removed')}: ${orderProgress(order.fragments,current.remainingTargets).removed}/${orderProgress(order.fragments,current.remainingTargets).total}` : `${order.fragments.length} · ${locale.t('fragments')}`;
   this.text(textX,y+36,progress,'caption',textWidth,'#98513F');
   this.zone(`order-${index+1}`,x,y,cardWidth,120,() => this.startOrder(order.id),!unlocked);
  });
  this.text(240,667,locale.t('future'),'caption',420,'#7A6A60');
  this.text(240,704,`${orders.filter(o=>campaign.completed.includes(o.id)).length} / ${orders.length} · ${locale.t('completed')}`,'caption',430,'#5B704D');
  const next = campaign.active?.status === 'running' ? campaign.active.orderId : CAMPAIGN_CATALOG.find(o => !campaign.completed.includes(o.id))?.id;
  this.button('journal-continue',next ? 'resume' : 'classic',240,756,() => {
   if (next) this.startOrder(next); else { this.mode='classic'; if (this.services.model.gameOver) this.services.model.commitRestart(); this.navigate('play'); }
  },360,false,true);
 }
 private startOrder(id: string, replay = false): void {
  if (this.services.campaign.start(id,replay || this.services.campaign.active?.orderId === id && this.services.campaign.active.status === 'succeeded')) { this.mode='campaign'; this.comboRemaining=0; this.commitNavigation('play'); this.services.audio.unlock(); }
 }
 private drawPlay(): void {
  const { locale, model, campaign, platform } = this.services;
  const active = campaign.active;
  this.header(this.mode === 'classic' ? locale.t('classic') : `${locale.t('order')} ${CAMPAIGN_CATALOG.findIndex(o => o.id === active?.orderId)+1}`,() => this.navigate(this.mode === 'campaign' ? 'journal' : 'menu'));
  if (this.mode === 'classic') {
   for (const [x,word,value] of [[126,'score',model.score],[354,'best',model.bestScore]] as const) {
    this.surface('panel',x,114,212,62);
    const label = this.text(x-84,111,locale.t(word),'caption',0,'#7A6A60').setOrigin(0,0.5);
    const amount = this.text(x+84,114,this.formatScore(value),'hudPrimary').setOrigin(1,0.5);
    // Keep a single line and a real gap for both locales, even for six-digit scores.
    const valueWidth = 168-label.width-12;
    if (amount.width > valueWidth) amount.setScale(valueWidth/amount.width);
   }
  } else if (active) {
   const order = findOrder(active.orderId)!;
   this.text(240,68,`${locale.t('targetsLeft')}: ${active.remainingTargets.length}`,'caption',300,'#98513F').setFontSize(16);
   const width = (464 - (order.fragments.length-1)*6)/order.fragments.length;
   order.fragments.forEach((fragment,i) => {
    const x = 8 + width/2 + i*(width+6), progress = fragmentProgress(fragment,active.remainingTargets);
    this.surface('order-card',x,113,width,66);
    // Reserve distinct miniature and copy columns, with at least 12px outer padding.
    const contentWidth = Math.min(width-24,136), contentLeft = x-contentWidth/2;
    this.drawFragment(fragment,contentLeft+20,113,40);
    const labelWidth = contentWidth-48, labelX = contentLeft+48+labelWidth/2;
    this.text(labelX,101,`${fragment.id} · ${progress.removed}/${progress.total}`,'body',labelWidth,progress.remaining ? '#4E4038' : '#5B704D').setFontSize(19);
    this.text(labelX,124,locale.t(progress.remaining ? 'removed' : 'completed'),'caption',labelWidth,progress.remaining ? '#7A6A60' : '#5B704D').setFontSize(15);
    this.zone(`goal-${fragment.id}`,x,113,width,66,() => { this.selectedFragment=fragment.id; this.openModal('goal'); });
   });
  }
  this.surface('board-frame',240,376,456,456,0xd8c9b7);
  const graphics = this.add.graphics(); this.root.add(graphics);
  for (let r=0;r<10;r++) for (let c=0;c<10;c++) this.tile(this.root,graphics,this.board[r]![c]!,BOARD.x+c*44,BOARD.y+r*44,44);
  if (this.mode === 'campaign' && active) this.drawTargets();
  if (this.comboRemaining > 0 && this.mode === 'classic') this.text(240,612,`${locale.t('combo')} ×${this.combo}`,'caption');
  this.pieces.forEach((piece,slot) => {
   this.surface('panel',TRAY.centers[slot]!,TRAY.y,140,112,0xefe4d6);
   if (!piece) return;
   const trayGraphics=this.add.graphics(); this.root.add(trayGraphics);
   this.drawPiece(this.root,trayGraphics,piece,TRAY.centers[slot]!-piece.bbox.w*TRAY.cell/2,TRAY.y-piece.bbox.h*TRAY.cell/2,TRAY.cell);
   const zone = this.add.zone(TRAY.centers[slot]!,TRAY.y,TRAY.hitWidth,TRAY.hitHeight).setName(`tray-${slot}`).setInteractive({useHandCursor:true});
   zone.on('pointerdown',(pointer: Phaser.Input.Pointer) => this.pickup(pointer,slot,piece)); this.root.add(zone);
  });
  this.button('restart',this.mode === 'classic' ? 'newGame' : 'retry',130,759,() => this.openModal('restart'),212);
  if (this.mode === 'classic') {
   if (!model.rewardUsed && model.canReward) this.button('reward','reward',360,759,() => this.openModal('reward'),212,platform.id !== 'yandex');
   if (model.gameOver) this.drawClassicOver();
  } else {
   this.button('journal','toOrders',360,759,() => this.navigate('journal'),212);
   if (active?.status !== 'running') this.drawCampaignResult();
  }
 }
 /** This miniature reads the immutable silhouette and the remaining-target mask only. */
 private drawFragment(fragment: TargetFragment, x: number, y: number, size: number): void {
  const active = this.services.campaign.active!, order = findOrder(active.orderId)!;
  const rows=fragment.cells.map(c=>Math.floor(c/10)), cols=fragment.cells.map(c=>c%10);
  const top=Math.min(...rows), left=Math.min(...cols), height=Math.max(...rows)-top+1, width=Math.max(...cols)-left+1;
  const cell=Math.min(size/width,size/height), remaining=new Set(active.remainingTargets);
  const graphics=this.add.graphics(); this.root.add(graphics);
  for (const address of fragment.cells) {
   const r=Math.floor(address/10), c=address%10, px=x-width*cell/2+(c-left)*cell, py=y-height*cell/2+(r-top)*cell;
   if (remaining.has(address)) this.tile(this.root,graphics,order.board[r]![c]!,px,py,cell);
   else {
    // Technical status marks: a faint empty square and a tick, never current board occupancy.
    graphics.fillStyle(0xd8c9b7,.5).fillRoundedRect(px+1,py+1,cell-2,cell-2,2);
    graphics.lineStyle(Math.max(1,cell*.08),0x5b704d,.85).lineBetween(px+cell*.23,py+cell*.5,px+cell*.43,py+cell*.7).lineBetween(px+cell*.43,py+cell*.7,px+cell*.78,py+cell*.28);
   }
  }
 }
 private drawTargets(): void {
  const graphics = this.add.graphics(); this.root.add(graphics);
  const remaining = this.services.campaign.active!.remainingTargets;
  for (const address of remaining) {
   const x=BOARD.x+(address%10)*44+22, y=BOARD.y+Math.floor(address/10)*44+22;
   // Reuse the approved raster mosaic seal, backed with ivory for contrast at phone scale.
   graphics.fillStyle(0xfff8ea,.96).fillCircle(x,y,14);
   if (this.textures.exists('cozy-cross')) this.root.add(this.add.image(x,y,'cozy-cross').setDisplaySize(22,22));
   else this.text(x,y,'◆','body',0,'#98513F').setFontSize(20);
  }
 }
 private drawClassicOver(): void {
  const { locale, model, platform } = this.services;
  this.root.add(createModalShell(this,{x:240,y:400,width:440,height:438}));
  this.text(240,270,locale.t('gameOver'),'screenTitle',400);
  this.text(240,327,`${locale.t('score')}: ${this.formatScore(model.score)}`,'hudPrimary');
  this.button('over-restart','newGame',240,400,() => this.openModal('restart'),320,false,true);
  if (!model.rewardUsed && model.canReward) this.button('over-reward','reward',240,467,() => this.openModal('reward'),320,platform.id !== 'yandex');
  this.button('over-menu','menu',240,534,() => this.navigate('menu'),320);
 }
 private drawCampaignResult(): void {
  const { campaign, locale } = this.services, active = campaign.active!;
  const success = active.status === 'succeeded', order = findOrder(active.orderId)!, index = CAMPAIGN_CATALOG.indexOf(order);
  const next = CAMPAIGN_CATALOG[index+1];
  this.root.add(createModalShell(this,{x:240,y:416,width:440,height:560}));
  if (success) this.icon('stamp',240,237,116,'✓'); else this.icon('retry',240,237,70,'↻');
  this.text(240,328,locale.t(success ? next ? 'orderDone' : 'sliceDone' : 'gameOver'),'screenTitle',390);
  this.text(240,380,order.title[locale.locale],'body',390);
  this.text(240,420,`${locale.t('moves')}: ${active.moves}`,'caption',350,'#7A6A60');
  const transition = (action: () => void): void => { void this.services.flow.transition(action,false); };
  if (success && next) this.button('next-order','nextOrder',240,480,() => transition(() => this.startOrder(next.id)),360,false,true);
  else this.button('result-journal','toOrders',240,480,() => this.navigate('journal'),360,false,true);
  this.button('result-retry','retry',240,553,() => transition(() => this.startOrder(order.id,true)),360);
  this.button('result-menu',success && next ? 'toOrders' : 'menu',240,626,() => this.navigate(success && next ? 'journal' : 'menu'),360);
 }
 private navigate(screen: 'menu' | 'journal' | 'play'): void {
  if (this.externalBlock() || this.modal || this.services.flow.busy) return;
  this.commitNavigation(screen);
  if (screen === 'journal' && this.services.campaign.notice) this.openModal('campaignNotice');
 }
 /** Ad destinations can navigate while transition/SDK pause still owns input. */
 private commitNavigation(screen: 'menu' | 'journal' | 'play'): void {
  this.cancelDrag(); this.effects.removeAll(true); this.screen=screen;
  this.services.gate.set('startup',screen !== 'play'); this.invalidate();
 }
 private openModal(modal: Exclude<Modal,null>): void {
  if (this.modal || this.externalBlock() || this.services.flow.busy) return;
  if (modal === 'reward') {
   if (this.mode !== 'classic' || this.services.platform.id !== 'yandex') return;
   this.offering=this.services.model.prepareReward(); if (!this.offering) return;
  }
  this.cancelDrag(); this.effects.removeAll(true); this.modal=modal; this.services.gate.set('manual',true); this.invalidate();
 }
 private closeModal(): void { this.modal=null; this.offering=null; this.services.gate.set('manual',false); this.invalidate(); }
 private drawModal(): void {
  const { locale, manager } = this.services;
  this.root.add(createModalShell(this,{x:240,y:400,width:440,height:this.modal === 'settings' || this.modal === 'goal' ? 640 : 360}));
  if (this.modal === 'settings') {
   this.text(240,124,locale.t('settings'),'screenTitle'); this.text(240,178,locale.t('language'));
   this.button('language-ru','RU',150,230,() => locale.set('ru'),150,false,locale.locale === 'ru');
   this.button('language-en','EN',330,230,() => locale.set('en'),150,false,locale.locale === 'en');
   for (const [word,y,value,set] of [
    ['music',326,manager.getSettings().musicVolume,(v:number)=>manager.setMusicVolume(v)],
    ['effects',426,manager.getSettings().sfxVolume,(v:number)=>manager.setSfxVolume(v)],
   ] as const) {
    const slider=createAudioVolumeSlider(this,this.services.density,{x:240,y,width:360,label:locale.t(word),value,onChange:set});
    slider.setName(`slider-${word}`); this.root.add(slider);
   }
   this.text(240,558,locale.t('shortRules'),'caption',370,'#7A6A60');
   this.button('close-settings','close',240,667,() => this.closeModal(),320);
  } else if (this.modal === 'goal') {
   const active=this.services.campaign.active!, order=findOrder(active.orderId)!;
   this.text(240,125,locale.t('goalDetails'),'screenTitle');
   const fragment = order.fragments.find(f=>f.id === this.selectedFragment) ?? order.fragments[0]!;
   const progress = fragmentProgress(fragment,active.remainingTargets);
   this.text(240,180,fragment.name[locale.locale],'body',390);
   this.drawFragment(fragment,240,268,100);
   this.text(240,350,`${locale.t('removed')}: ${progress.removed}/${progress.total} · ${locale.t('left')}: ${progress.remaining}`,'body',390);
   this.text(240,477,locale.t('orderRules'),'body',370);
   this.button('close-goal','close',240,667,() => this.closeModal(),320);
  } else if (this.modal === 'campaignNotice') {
   this.text(240,274,locale.t('campaignUpdated'),'screenTitle',390);
   this.text(240,371,locale.t(this.services.campaign.notice === 'updated' ? 'campaignReset' : 'campaignRecovered'),'body',370);
   this.button('acknowledge-campaign','close',240,508,() => { this.services.campaign.acknowledgeNotice(); this.closeModal(); },320,false,true);
  } else {
   const restart=this.modal === 'restart', campaign=this.mode === 'campaign';
   this.text(240,273,locale.t(restart ? campaign ? 'retry' : 'newGame' : 'reward'),'screenTitle',400);
   this.text(240,359,locale.t(restart ? campaign ? 'retryConfirm' : 'restartConfirm' : 'rewardConfirm'),'body',380);
   this.button('confirm','yes',240,450,() => {
    const offer=this.offering; this.closeModal();
    if (restart) {
     this.comboRemaining=0;
     if (campaign) { const id=this.services.campaign.active!.orderId; this.startOrder(id,true); }
     else void this.services.flow.restart();
    } else if (offer) void this.services.flow.reward(offer).then(granted => {
     if (this.disposed || !this.scene.isActive()) return;
     if (!granted) this.noticeUntil=performance.now()+4000; this.invalidate();
    });
   },320,false,true);
   this.button('cancel','no',240,518,() => this.closeModal(),320);
  }
 }
 private formatScore(n: number): string {
  const l=this.services.locale.locale;
  if (n >= 1e6) return new Intl.NumberFormat(l,{notation:'compact',maximumFractionDigits:1}).format(n);
  return new Intl.NumberFormat(l).format(n);
 }
 private tile(target: Phaser.GameObjects.Container,graphics: Phaser.GameObjects.Graphics,family: PieceFamily | null,x: number,y: number,cell: number): void {
  const key=family ? `cozy-tile-${TILE_MATERIAL[family]}` : 'cozy-cell-empty';
  if (this.textures.exists(key)) target.add(this.add.image(x+cell/2,y+cell/2,key).setDisplaySize(cell,cell));
  else graphics.fillStyle(family ? PIECE_COLORS[family] : 0xe7dccf).fillRoundedRect(x+1,y+1,cell-2,cell-2,3);
 }
 private drawPiece(target: Phaser.GameObjects.Container,graphics: Phaser.GameObjects.Graphics,piece: Piece,x: number,y: number,cell: number): void {
  for (const [r,c] of piece.cells) this.tile(target,graphics,piece.family,x+c*cell,y+r*cell,cell);
 }
 private pickup(pointer: Phaser.Input.Pointer,slot: number,piece: Piece): void {
  if (this.screen !== 'play' || this.drag || this.services.gate.paused || this.terminal || this.externalBlock()) return;
  this.drag={pointerId:pointer.id,slot,piece,lift:pointer.wasTouch ? 40 : 0,x:0,y:0}; this.services.audio.pickup(); this.move(pointer);
 }
 private move(pointer: Phaser.Input.Pointer): void {
  const drag=this.drag; if (!drag || pointer.id !== drag.pointerId) return;
  if (this.services.gate.paused) { this.cancelDrag(); return; }
  const world=this.cameras.main.getWorldPoint(pointer.x,pointer.y); drag.x=world.x; drag.y=world.y-drag.lift;
  this.ghost.removeAll(true); this.preview.clear();
  const graphics=this.add.graphics();this.ghost.add(graphics);
  this.drawPiece(this.ghost,graphics,drag.piece,drag.x-22,drag.y-22,44);this.ghost.setAlpha(.86);
  const anchor=boardAnchor(drag.x,drag.y); if (!anchor) return;
  const valid=canPlace(this.board,drag.piece,anchor.row,anchor.col), color=valid ? 0x47735b : 0xa5423f;
  this.preview.fillStyle(color,.22).lineStyle(2,color,1);
  for (const [r,c] of drag.piece.cells) {
   const row=anchor.row+r,col=anchor.col+c;
   if (row>=10 || col>=10) continue;
   const x=BOARD.x+col*44+1,y=BOARD.y+row*44+1;
   this.preview.fillRoundedRect(x,y,42,42,3).strokeRoundedRect(x,y,42,42,3);
   if (!valid) for (let i=7;i<35;i+=10) this.preview.lineBetween(x+5,y+i,x+15,y+i-5);
  }
 }
 private release(pointer: Phaser.Input.Pointer): void {
  const drag=this.drag;if (!drag || pointer.id !== drag.pointerId) return;
  this.move(pointer); const anchor=boardAnchor(drag.x,drag.y); this.cancelDrag();
  if (!this.services.gate.paused && anchor && canPlace(this.board,drag.piece,anchor.row,anchor.col)) {
   const before=this.board;
   if (this.mode === 'classic') this.services.model.place(drag.slot,anchor.row,anchor.col);
   else {
    const oldRemaining=this.services.campaign.active!.remainingTargets.length;
    this.services.campaign.place(drag.slot,anchor.row,anchor.col);
    const active=this.services.campaign.active!;
    if (active.status === 'succeeded') this.services.audio.perfect();
    else if (active.status === 'failed') this.services.audio.gameOver();
    else if (active.remainingTargets.length < oldRemaining) this.services.audio.clear(); else this.services.audio.place();
   }
   if (!this.terminal) for (let r=0;r<10;r++) for (let c=0;c<10;c++) if (before[r]![c] && !this.board[r]![c]) {
    const light=this.add.rectangle(BOARD.x+c*44+22,BOARD.y+r*44+22,40,40,0xfff8f1,.75);this.effects.add(light);
    this.tweens.add({targets:light,alpha:0,duration:180,onComplete:()=>light.destroy()});
   }
  } else this.services.audio.reject();
 }
 cancelDrag(): void { this.drag=null;this.ghost?.removeAll(true);this.preview?.clear(); }
}

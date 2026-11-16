import type { PauseGate } from './PauseGate';
import type { PlatformService } from '../platform/PlatformService';
import type { InterstitialController } from '../platform/InterstitialController';
export interface RewardOffer { readonly session: number; readonly revision: number; }
/** One transaction across both formats. Ad callbacks settle actions; SDK events own SDK pause. */
export class AdFlow<T extends RewardOffer> {
 private pending = false;
 private disposed = false;
 private staged: T | null = null;
 constructor(private deps: {
  gate: PauseGate; platform: PlatformService;
  interstitial: Pick<InterstitialController, 'tryShow'> & Partial<Pick<InterstitialController, 'recordShown'>>;
  cover: (visible: boolean) => void; afterFrame: () => Promise<void>;
  restart: () => void; applyReward: (offer: T) => boolean; refreshAfterTransition?: () => void;
 }) {}
 get busy(): boolean { return this.pending || this.staged !== null; }
 async restart(): Promise<void> { return this.transition(this.deps.restart); }
 async transition(destination: () => void, showAd = true): Promise<void> { await this.transact(destination, showAd); }
 async intermission(): Promise<boolean> { return this.transact(() => {}, true); }
 private async transact(destination: () => void, showAd: boolean): Promise<boolean> {
  // 'startup' also marks non-gameplay menu/journal screens. Explicit journal
  // replay may transition from there; every actual input/pause owner still blocks it.
  const blocked = (['sdk','browser','focus','ad','transition','input','manual'] as const).some(reason => this.deps.gate.has(reason));
  if (this.disposed || this.busy || blocked) return false;
  this.pending = true;
  this.deps.gate.set('transition', true);
  let shown = false;
  try {
   try { if (showAd) shown = await this.deps.interstitial.tryShow(() => { this.deps.gate.set('ad', true); this.deps.cover(true); }); } catch { /* Continue on error/no-fill. */ }
   this.deps.gate.set('ad', false);
   if (this.disposed) return false;
   destination();
   await this.deps.afterFrame();
   return shown;
  } finally {
   this.deps.cover(false);
   this.deps.gate.set('ad', false);
   this.pending = false;
   this.deps.gate.set('transition', false);
   if (!this.disposed) this.deps.refreshAfterTransition?.();
  }
 }
 async reward(offer: T): Promise<boolean> {
  if (this.disposed || this.busy || this.deps.gate.paused) return false;
  this.pending = true;
  this.deps.gate.set('ad', true);
  let granted = false, opened = false;
  try { granted = await this.deps.platform.showRewarded(() => { opened = true; this.deps.cover(true); }); }
  catch { granted = false; }
  finally {
   if (opened) this.deps.interstitial.recordShown?.();
   if (granted && !this.disposed) this.staged = offer;
   this.deps.cover(false);
   this.pending = false;
   this.deps.gate.set('ad', false);
  }
  this.flushReward();
  return granted && !this.disposed;
 }
 dispose(): void { this.disposed = true; this.staged = null; }
 flushReward(): void {
  if (this.disposed || this.deps.gate.paused || !this.staged) return;
  const offer = this.staged;
  this.staged = null;
  this.deps.applyReward(offer);
 }
}

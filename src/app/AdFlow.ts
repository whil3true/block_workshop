import type { PauseGate } from './PauseGate';
import type { PlatformService } from '../platform/PlatformService';
import type { InterstitialController } from '../platform/InterstitialController';
export interface RewardOffer { readonly session: number; readonly revision: number; }
/** One transaction across both ad formats. Callbacks settle navigation, never SDK resume. */
export class AdFlow<T extends RewardOffer> {
 private pending = false;
 private disposed = false;
 private staged: T | null = null;
 constructor(private deps: {
  gate: PauseGate; platform: PlatformService; interstitial: Pick<InterstitialController, 'tryShow'>;
  cover: (visible: boolean) => void; afterFrame: () => Promise<void>;
  restart: () => void; applyReward: (offer: T) => boolean;
 }) {}
 get busy(): boolean { return this.pending || this.staged !== null; }
 async restart(): Promise<void> { return this.transition(this.deps.restart); }
 async transition(destination: () => void, showAd = true): Promise<void> {
  if (this.disposed || this.busy || this.deps.gate.paused) return;
  this.pending = true;
  this.deps.gate.set('transition', true);
  try {
   try { if (showAd) await this.deps.interstitial.tryShow(() => this.deps.cover(true)); } catch { /* no-fill/error still reaches destination */ }
   if (this.disposed) return;
   destination(); // Destination exists immediately after close/error, even while SDK-paused.
   await this.deps.afterFrame();
  } finally {
   this.deps.cover(false);
   this.pending = false;
   this.deps.gate.set('transition', false);
  }
 }
 async reward(offer: T): Promise<boolean> {
  if (this.disposed || this.busy || this.deps.gate.paused) return false;
  this.pending = true;
  this.deps.gate.set('ad', true);
  let granted = false;
  try { granted = await this.deps.platform.showRewarded(); }
  catch { granted = false; }
  finally {
   if (granted && !this.disposed) this.staged = offer;
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
  this.staged = null; // Clear before invoking consumer: reentrant callbacks cannot apply twice.
  this.deps.applyReward(offer); // Consumer rejects old session/revision.
 }
}

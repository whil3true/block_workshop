export const CLASSIC_AD_ACTIVE_MS = 90_000;
export const CLASSIC_AD_RETRY_ACTIVE_MS = 15_000;
/** Eligibility only. Advertising is requested exclusively at a completed placement. */
export class ClassicAdClock {
 private elapsed = 0;
 private active = false;
 private sampledAt: number;
 private disposed = false;
 constructor(private readonly now: () => number = () => performance.now()) { this.sampledAt = now(); }
 private sample(): void {
  const time = this.now();
  if (this.active && !this.disposed) this.elapsed += Math.max(0, time - this.sampledAt);
  this.sampledAt = time;
 }
 setActive(active: boolean): void { this.sample(); this.active = active && !this.disposed; }
 get due(): boolean { this.sample(); return !this.disposed && this.elapsed >= CLASSIC_AD_ACTIVE_MS; }
 reset(): void { this.elapsed = 0; this.sampledAt = this.now(); }
 attemptFinished(shown: boolean): void {
  this.reset();
  if (!shown) this.elapsed = CLASSIC_AD_ACTIVE_MS - CLASSIC_AD_RETRY_ACTIVE_MS;
 }
 dispose(): void { this.active = false; this.disposed = true; this.reset(); }
}

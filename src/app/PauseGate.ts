export type PauseReason = 'sdk' | 'browser' | 'manual' | 'startup' | 'transition' | 'ad';
/** Each owner can release only its own reason. Subscribers see the initial state. */
export class PauseGate {
 private reasons = new Set<PauseReason>();
 private listeners = new Set<() => void>();
 get paused(): boolean { return this.reasons.size > 0; }
 has(reason: PauseReason): boolean { return this.reasons.has(reason); }
 set(reason: PauseReason, active: boolean): void {
  const before = this.reasons.has(reason);
  if (before === active) return;
  if (active) this.reasons.add(reason); else this.reasons.delete(reason);
  for (const f of this.listeners) f();
 }
 subscribe(f: () => void): () => void { this.listeners.add(f); f(); return () => { this.listeners.delete(f); }; }
}

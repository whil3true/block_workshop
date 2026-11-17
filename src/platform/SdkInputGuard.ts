/**
 * Capture input before Phaser, including while SDK/font loading is in progress.
 * Resume never admits the release/click of a pointer held across an advertisement.
 * The guard owns only PauseGate.input; it never synthesizes an SDK resume.
 */
export class SdkInputGuard {
 private blocked = true;
 private locked = true;
 private disposed = false;
 private generation = 0;
 private releasing = false;
 private pointers = new Set<number>();
 private touches = new Set<number>();
 private listeners = new Set<() => void>();
 private readonly options = { capture: true, passive: false };
 constructor(private readonly afterFrame: () => Promise<void>, private readonly target: Window = window) {
  for (const type of ['pointerdown','pointerup','pointercancel','touchstart','touchend','touchcancel','mousedown','mouseup','click','keydown','keyup']) {
   target.addEventListener(type, this.capture, this.options);
  }
 }
 get isLocked(): boolean { return this.locked; }
 subscribe(listener: () => void): () => void { this.listeners.add(listener); listener(); return () => { this.listeners.delete(listener); }; }
 setBlocked(blocked: boolean): void {
  if (this.disposed || this.blocked === blocked) return;
  this.blocked = blocked; this.generation++; this.releasing = false;
  if (blocked) this.setLocked(true);
  else this.releaseWhenIdle();
 }
 private setLocked(locked: boolean): void {
  if (this.locked === locked) return;
  this.locked = locked;
  for (const listener of this.listeners) listener();
 }
 private readonly capture = (event: Event): void => {
  if (event instanceof PointerEvent) {
   if (event.type === 'pointerdown') this.pointers.add(event.pointerId);
   else this.pointers.delete(event.pointerId);
  }
  if ('changedTouches' in event) {
   const touchEvent = event as TouchEvent;
   for (const touch of Array.from(touchEvent.changedTouches)) {
    if (event.type === 'touchstart') this.touches.add(touch.identifier);
    else this.touches.delete(touch.identifier);
   }
  }
  if (this.locked) {
   if (event.cancelable) event.preventDefault();
   event.stopImmediatePropagation();
  }
  this.releaseWhenIdle();
 };
 private releaseWhenIdle(): void {
  if (this.disposed || this.blocked || !this.locked || this.pointers.size || this.touches.size || this.releasing) return;
  const generation = this.generation;
  this.releasing = true;
  void this.afterFrame().then(() => {
   if (this.disposed || generation !== this.generation) return;
   this.releasing = false;
   if (!this.blocked && !this.pointers.size && !this.touches.size) this.setLocked(false);
  });
 }
 dispose(): void {
  this.disposed = true; this.generation++;
  for (const type of ['pointerdown','pointerup','pointercancel','touchstart','touchend','touchcancel','mousedown','mouseup','click','keydown','keyup']) {
   this.target.removeEventListener(type, this.capture, this.options);
  }
  this.listeners.clear(); this.pointers.clear(); this.touches.clear();
 }
}

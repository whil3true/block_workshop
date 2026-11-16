import { applyPlacement, canPlace, hasAnyLegalPlacement, lineBonus, resolveClears, streakMultiplier, type BoardState } from '../engine';
import { findPieceById, sampleTray } from '../pieces';
import { clearTargets, initialTargets, type TargetCell } from './OrderRules';
import { findOrder, isOrderUnlocked, type OrderConfig } from './CampaignCatalog';
import { loadCampaign, saveCampaign, type CampaignState } from './CampaignStore';
export interface CampaignAttempt {
 readonly orderId: string; readonly contentVersion: number; readonly targetRulesVersion: 2;
 readonly board: BoardState; readonly trayIds: readonly (string | null)[];
 readonly nextTrayIndex: number; readonly rngState: number;
 readonly score: number; readonly streak: number; readonly moves: number;
 readonly remainingTargets: readonly TargetCell[]; readonly status: 'running' | 'succeeded' | 'failed';
}
/** Entropy is sampled once per random attempt, never from the board or target mask. */
export function freshAttemptSeed(): number {
 return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] || 0x9e3779b9;
}
/** Same weighted, board-independent sampler as Classic. No rescue/redeal loop. */
export function randomCampaignTray(seed: number): { trayIds: string[]; rngState: number } {
 let rngState = seed;
 const rng = (): number => { let x = rngState; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; rngState = x >>> 0; return rngState / 4294967296; };
 return { trayIds: sampleTray(rng, 3).map(p => p.id), rngState };
}
export function initialAttempt(order: OrderConfig, seed?: number): CampaignAttempt {
 if (seed !== undefined && (!Number.isInteger(seed) || seed <= 0 || seed > 0xffffffff)) throw new RangeError('Expected a nonzero uint32 attempt seed');
 const deal = order.deal === 'fixed' ? { trayIds: [...order.trays[0]!], rngState: order.seed }
  : randomCampaignTray(seed ?? freshAttemptSeed());
 return { orderId: order.id, contentVersion: order.contentVersion, targetRulesVersion: 2, board: order.board.map(r => [...r]),
  ...deal, nextTrayIndex: 1, score: 0, streak: 0, moves: 0, remainingTargets: initialTargets(order.fragments), status: hasAnyLegalPlacement(order.board, deal.trayIds.map(id => findPieceById(id)!)) ? 'running' : 'failed' };
}
/** Pure transaction shared by runtime, solution replay and balance checks. No classic persistence or records. */
export function placeCampaign(state: CampaignAttempt, slot: number, row: number, col: number): CampaignAttempt {
 if (state.status !== 'running' || !Number.isInteger(slot) || !Number.isInteger(row) || !Number.isInteger(col)) return state;
 const piece = findPieceById(state.trayIds[slot] ?? '');
 if (!piece || !canPlace(state.board, piece, row, col)) return state;
 const order = findOrder(state.orderId); if (!order) return state;
 const cleared = resolveClears(applyPlacement(state.board, piece, row, col));
 const remainingTargets = clearTargets(state.remainingTargets, cleared);
 const lines = cleared.rowsCleared.length + cleared.colsCleared.length;
 const streak = lines ? state.streak + 1 : 0;
 const score = state.score + piece.cells.length + Math.round(lineBonus(lines) * streakMultiplier(streak)) + (cleared.board.every(r => r.every(c => c === null)) ? 300 : 0);
 let trayIds = [...state.trayIds], nextTrayIndex = state.nextTrayIndex, rngState = state.rngState;
 trayIds[slot] = null;
 // Victory takes priority over empty tray / blocked board. A completed attempt never consumes another deal.
 let status: CampaignAttempt['status'] = remainingTargets.length === 0 ? 'succeeded' : 'running';
 if (status === 'running') {
  if (trayIds.every(id => id === null)) {
   const fixed = order.deal === 'fixed' ? order.trays[nextTrayIndex] : undefined;
   nextTrayIndex++;
   if (fixed) trayIds = [...fixed];
   else ({ trayIds, rngState } = randomCampaignTray(rngState));
  }
  if (!hasAnyLegalPlacement(cleared.board, trayIds.map(id => id ? findPieceById(id) ?? null : null))) status = 'failed';
 }
 return { ...state, remainingTargets, board: cleared.board, trayIds, nextTrayIndex, rngState, score, streak, moves: state.moves + 1, status };
}
export class CampaignController {
 private state: CampaignState;
 constructor(private onChange: () => void = () => {}, private canInteract: () => boolean = () => true, private seedSource: (order: OrderConfig) => number = freshAttemptSeed) {
  this.state = loadCampaign();
  // Normalize older saved attempts to achievements-only storage on startup.
  saveCampaign(this.state);
 }
 get notice(): CampaignState['notice'] { return this.state.notice; }
 acknowledgeNotice(): void { this.state = { ...this.state, notice: null }; this.persist(); }
 get active(): CampaignAttempt | null { return this.state.active; }
 get completed(): readonly string[] { return this.state.completedOrderIds; }
 start(id: string, _replay = false): boolean {
  const order = findOrder(id); if (!order || !isOrderUnlocked(id, this.completed)) return false;
  // All orders start fresh on every entry. Partial play is intentionally not persistent.
  this.state = { ...this.state, active: initialAttempt(order, order.deal === 'random' ? this.seedSource(order) : undefined) };
  this.onChange(); return true;
 }
 /** Leaving an order discards its short-lived attempt, preserving earned completions. */
 abandon(): void {
  if (!this.state.active) return;
  this.state = { ...this.state, active: null };
  this.onChange();
 }
 place(slot: number, row: number, col: number): boolean {
  if (!this.canInteract() || !this.active) return false;
  const next = placeCampaign(this.active, slot, row, col); if (next === this.active) return false;
  const completedOrderIds = next.status === 'succeeded' ? [...new Set([...this.completed, next.orderId])] : [...this.completed];
  this.state = { ...this.state, active: next, completedOrderIds };
  // Save only earned completions, not the live board or remaining targets.
  if (next.status === 'succeeded') this.persist(); else this.onChange();
  return true;
 }
 private persist(): void { saveCampaign(this.state); this.onChange(); }
}

import { applyPlacement, canPlace, hasAnyLegalPlacement, lineBonus, resolveClears, streakMultiplier, type BoardState } from '../engine';
import { findPieceById, sampleTray } from '../pieces';
import { advanceOrder } from './OrderRules';
import { findOrder, isOrderUnlocked, type OrderConfig } from './CampaignCatalog';
import { loadCampaign, saveCampaign, type CampaignState } from './CampaignStore';
export interface CampaignAttempt {
 readonly orderId: string; readonly contentVersion: number; readonly operationRulesVersion: 1;
 readonly board: BoardState; readonly trayIds: readonly (string | null)[];
 readonly nextTrayIndex: number; readonly rngState: number;
 readonly score: number; readonly streak: number; readonly moves: number;
 readonly stage: number; readonly count: number; readonly status: 'running' | 'succeeded' | 'failed';
}
export function initialAttempt(order: OrderConfig): CampaignAttempt {
 return { orderId: order.id, contentVersion: order.contentVersion, operationRulesVersion: 1, board: order.board.map(r => [...r]),
  trayIds: [...order.trays[0]!], nextTrayIndex: 1, rngState: order.seed, score: 0, streak: 0, moves: 0, stage: 0, count: 0, status: 'running' };
}
/** Pure transaction shared by runtime, solution replay and balance checks. No classic persistence or records. */
export function placeCampaign(state: CampaignAttempt, slot: number, row: number, col: number): CampaignAttempt {
 if (state.status !== 'running' || !Number.isInteger(slot) || !Number.isInteger(row) || !Number.isInteger(col)) return state;
 const piece = findPieceById(state.trayIds[slot] ?? '');
 if (!piece || !canPlace(state.board, piece, row, col)) return state;
 const order = findOrder(state.orderId); if (!order) return state;
 const cleared = resolveClears(applyPlacement(state.board, piece, row, col));
 const progress = advanceOrder(order.operations, state, cleared);
 const lines = cleared.rowsCleared.length + cleared.colsCleared.length;
 const streak = lines ? state.streak + 1 : 0;
 const score = state.score + piece.cells.length + Math.round(lineBonus(lines) * streakMultiplier(streak)) + (cleared.board.every(r => r.every(c => c === null)) ? 300 : 0);
 let trayIds = [...state.trayIds], nextTrayIndex = state.nextTrayIndex, rngState = state.rngState;
 trayIds[slot] = null;
 // Victory takes priority over empty tray / blocked board. A completed attempt never consumes another deal.
 let status: CampaignAttempt['status'] = progress.stage === order.operations.length ? 'succeeded' : 'running';
 if (status === 'running') {
  if (trayIds.every(id => id === null)) {
   const fixed = order.trays[nextTrayIndex++];
   const rng = (): number => { let x = rngState; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; rngState = x >>> 0; return rngState / 4294967296; };
   trayIds = fixed ? [...fixed] : sampleTray(rng, 3).map(p => p.id);
  }
  if (!hasAnyLegalPlacement(cleared.board, trayIds.map(id => id ? findPieceById(id) ?? null : null))) status = 'failed';
 }
 return { ...state, ...progress, board: cleared.board, trayIds, nextTrayIndex, rngState, score, streak, moves: state.moves + 1, status };
}
export class CampaignController {
 private state: CampaignState;
 constructor(private onChange: () => void = () => {}, private canInteract: () => boolean = () => true) { this.state = loadCampaign(); }
 get active(): CampaignAttempt | null { return this.state.active; }
 get completed(): readonly string[] { return this.state.completedOrderIds; }
 start(id: string, replay = false): boolean {
  const order = findOrder(id); if (!order || !isOrderUnlocked(id, this.completed)) return false;
  if (replay || this.active?.orderId !== id) this.state = { ...this.state, active: initialAttempt(order) };
  this.persist(); return true;
 }
 place(slot: number, row: number, col: number): boolean {
  if (!this.canInteract() || !this.active) return false;
  const next = placeCampaign(this.active, slot, row, col); if (next === this.active) return false;
  const completedOrderIds = next.status === 'succeeded' ? [...new Set([...this.completed, next.orderId])] : [...this.completed];
  this.state = { ...this.state, active: next, completedOrderIds };
  this.persist(); return true;
 }
 private persist(): void { saveCampaign(this.state); this.onChange(); }
}

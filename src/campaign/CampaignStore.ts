import { hasAnyLegalPlacement } from '../engine';
import { findPieceById, PIECE_FAMILIES } from '../pieces';
import { findOrder, isOrderUnlocked } from './CampaignCatalog';
import type { CampaignAttempt } from './CampaignSession';
export const CAMPAIGN_KEY = 'block-workshop:campaign:v1';
export interface CampaignState { readonly completedOrderIds: readonly string[]; readonly active: CampaignAttempt | null; }
const uint = (v: unknown, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;
function validAttempt(v: unknown): v is CampaignAttempt {
 if (!v || typeof v !== 'object') return false;
 const a = v as CampaignAttempt, order = findOrder(a.orderId);
 if (!order || a.contentVersion !== order.contentVersion || a.operationRulesVersion !== 1) return false;
 if (!Array.isArray(a.board) || a.board.length !== 10 || !a.board.every(row => Array.isArray(row) && row.length === 10 && row.every(c => c === null || PIECE_FAMILIES.includes(c)))) return false;
 if (!Array.isArray(a.trayIds) || a.trayIds.length !== 3 || !a.trayIds.every(id => id === null || typeof id === 'string' && !!findPieceById(id))) return false;
 if (!uint(a.nextTrayIndex) || a.nextTrayIndex < 1 || !uint(a.rngState, 0xffffffff) || a.rngState === 0 || !uint(a.score) || !uint(a.streak) || !uint(a.moves) || !uint(a.stage, order.operations.length) || !uint(a.count)) return false;
 if (a.nextTrayIndex > 1 + Math.floor(a.moves / 3) || a.stage > a.moves || a.streak > a.moves) return false;
 const op = order.operations[a.stage];
 if (op ? a.count >= (op.kind === 'lines' ? op.count : 1) : a.count !== 0) return false;
 const fits = hasAnyLegalPlacement(a.board, a.trayIds.map(id => id ? findPieceById(id) ?? null : null));
 return a.status === 'succeeded' ? a.stage === order.operations.length
  : a.stage < order.operations.length && (a.status === 'running' ? fits : a.status === 'failed' && !fits);
}
export function loadCampaign(): CampaignState {
 try {
  const v = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) ?? 'null');
  if (!v || v.app !== 'block-workshop' || v.mode !== 'campaign' || v.schemaVersion !== 1 || v.catalogVersion !== 1) return { completedOrderIds: [], active: null };
  const completedOrderIds: string[] = Array.isArray(v.completedOrderIds) ? [...new Set<string>(v.completedOrderIds.filter((id: unknown) => typeof id === 'string' && !!findOrder(id)))] : [];
  const active = validAttempt(v.active) && isOrderUnlocked(v.active.orderId, completedOrderIds)
   && (v.active.status !== 'succeeded' || completedOrderIds.includes(v.active.orderId)) ? v.active : null;
  return { completedOrderIds, active };
 } catch { return { completedOrderIds: [], active: null }; }
}
export function saveCampaign(state: CampaignState): void {
 try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify({ app: 'block-workshop', mode: 'campaign', schemaVersion: 1, catalogVersion: 1, ...state })); }
 catch { /* Storage denial must not interrupt a playable session. */ }
}

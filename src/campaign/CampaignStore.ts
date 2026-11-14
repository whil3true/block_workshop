import { hasAnyLegalPlacement, resolveClears } from '../engine';
import { findPieceById, PIECE_FAMILIES } from '../pieces';
import { CAMPAIGN_CATALOG, findOrder, isOrderUnlocked } from './CampaignCatalog';
import { initialTargets } from './OrderRules';
import type { CampaignAttempt } from './CampaignSession';
export const LEGACY_CAMPAIGN_KEY = 'block-workshop:campaign:v1';
export const CAMPAIGN_KEY = 'block-workshop:campaign:v2';
export type CampaignNotice = 'updated' | 'recovered' | null;
export interface CampaignState {
 readonly completedOrderIds: readonly string[]; readonly active: CampaignAttempt | null; readonly notice?: CampaignNotice;
}
const empty = (notice: CampaignNotice = null): CampaignState => ({ completedOrderIds: [], active: null, notice });
const uint = (v: unknown, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;
export function validAttempt(v: unknown): v is CampaignAttempt {
 if (!v || typeof v !== 'object') return false;
 const a = v as CampaignAttempt, order = findOrder(a.orderId);
 if (!order || a.contentVersion !== order.contentVersion || a.targetRulesVersion !== 2 || 'stage' in a || 'count' in a) return false;
 if (!Array.isArray(a.board) || a.board.length !== 10 || !a.board.every(row => Array.isArray(row) && row.length === 10 && row.every(c => c === null || PIECE_FAMILIES.includes(c)))) return false;
 const cleared = resolveClears(a.board);
 if (cleared.rowsCleared.length || cleared.colsCleared.length) return false;
 if (!Array.isArray(a.trayIds) || a.trayIds.length !== 3 || !a.trayIds.every(id => id === null || typeof id === 'string' && !!findPieceById(id))) return false;
 if (!uint(a.nextTrayIndex) || a.nextTrayIndex < 1 || !uint(a.rngState, 0xffffffff) || a.rngState === 0 || !uint(a.score) || !uint(a.streak) || !uint(a.moves)) return false;
 if (a.streak > a.moves) return false;
 const original = initialTargets(order.fragments), originals = new Set(original);
 if (!Array.isArray(a.remainingTargets) || new Set(a.remainingTargets).size !== a.remainingTargets.length || !a.remainingTargets.every(cell => uint(cell,99) && originals.has(cell) && a.board[Math.floor(cell/10)]![cell%10] === order.board[Math.floor(cell/10)]![cell%10])) return false;
 const used = a.trayIds.filter(id => id === null).length;
 if (used !== a.moves % 3 && !(a.status === 'succeeded' && used === 3 && a.moves % 3 === 0)) return false;
 if (a.nextTrayIndex !== 1 + Math.floor((a.moves - used) / 3)) return false;
 if (a.moves === 0 && (a.remainingTargets.length !== original.length || JSON.stringify(a.board) !== JSON.stringify(order.board) || JSON.stringify(a.trayIds) !== JSON.stringify(order.trays[0]) || a.rngState !== order.seed || a.score !== 0 || a.streak !== 0)) return false;
 const fits = hasAnyLegalPlacement(a.board, a.trayIds.map(id => id ? findPieceById(id) ?? null : null));
 return a.status === 'succeeded' ? a.remainingTargets.length === 0 && a.moves > 0
  : a.remainingTargets.length > 0 && (a.status === 'running' ? fits : a.status === 'failed' && !fits);
}
export function loadCampaign(): CampaignState {
 try {
  const raw = localStorage.getItem(CAMPAIGN_KEY);
  if (raw === null) return empty(localStorage.getItem(LEGACY_CAMPAIGN_KEY) !== null ? 'updated' : null);
  const v = JSON.parse(raw);
  if (!v || v.app !== 'block-workshop' || v.mode !== 'campaign' || v.schemaVersion !== 2 || v.catalogVersion !== 2 || v.targetRulesVersion !== 2) return empty('recovered');
  // Completed orders form a prefix. Preserve trustworthy completion if the active snapshot is damaged.
  const completedOrderIds: string[] = [];
  for (const order of CAMPAIGN_CATALOG) {
   if (!Array.isArray(v.completedOrderIds) || !v.completedOrderIds.includes(order.id)) break;
   completedOrderIds.push(order.id);
  }
  const active = validAttempt(v.active) && isOrderUnlocked(v.active.orderId, completedOrderIds)
   && (v.active.status !== 'succeeded' || completedOrderIds.includes(v.active.orderId)) ? v.active : null;
  const damaged = v.active !== null && active === null || !Array.isArray(v.completedOrderIds) || v.completedOrderIds.length !== completedOrderIds.length;
  return { completedOrderIds, active, notice: damaged ? 'recovered' : v.notice === 'updated' || v.notice === 'recovered' ? v.notice : null };
 } catch { return empty('recovered'); }
}
export function saveCampaign(state: CampaignState): void {
 try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify({ app: 'block-workshop', mode: 'campaign', schemaVersion: 2, catalogVersion: 2, targetRulesVersion: 2, ...state })); }
 catch { /* Storage denial must not interrupt a playable session. */ }
}

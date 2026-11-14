import type { ClearResult } from '../engine';

/** Row-major board addresses. Identity belongs to the original tile, never its replacement. */
export type TargetCell = number;
export interface TargetFragment {
 readonly id: string;
 readonly name: { readonly ru: string; readonly en: string };
 readonly cells: readonly TargetCell[];
}
export interface FragmentProgress { readonly total: number; readonly removed: number; readonly remaining: number; }
export const targetCell = (row: number, col: number): TargetCell => row * 10 + col;
export const initialTargets = (fragments: readonly TargetFragment[]): readonly TargetCell[] => fragments.flatMap(f => [...f.cells]);

/** Filter a union of cleared addresses once, including row/column intersections. No active stage. */
export function clearTargets(remaining: readonly TargetCell[], clear: Pick<ClearResult, 'rowsCleared' | 'colsCleared'>): readonly TargetCell[] {
 const rows = new Set(clear.rowsCleared), cols = new Set(clear.colsCleared);
 return remaining.filter(cell => !rows.has(Math.floor(cell / 10)) && !cols.has(cell % 10));
}
export function fragmentProgress(fragment: TargetFragment, remaining: readonly TargetCell[]): FragmentProgress {
 const mask = new Set(remaining), count = fragment.cells.filter(cell => mask.has(cell)).length;
 return { total: fragment.cells.length, removed: fragment.cells.length - count, remaining: count };
}
export function orderProgress(fragments: readonly TargetFragment[], remaining: readonly TargetCell[]): FragmentProgress {
 const total = fragments.reduce((sum, f) => sum + f.cells.length, 0);
 return { total, removed: total - remaining.length, remaining: remaining.length };
}

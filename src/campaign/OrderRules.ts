import type { ClearResult } from '../engine';
export type Operation =
 | { kind: 'lines'; axis: 'row' | 'column' | 'any'; count: number }
 | { kind: 'targetLine'; axis: 'row' | 'column'; index: number }
 | { kind: 'crossClear' };
export interface OrderProgress { readonly stage: number; readonly count: number; }
/** Exactly one active operation consumes a placement. Extra lines never spill into the next stage. */
export function advanceOrder(operations: readonly Operation[], progress: OrderProgress, clear: Pick<ClearResult, 'rowsCleared' | 'colsCleared'>): OrderProgress {
 const op = operations[progress.stage]; if (!op) return progress;
 const rows = clear.rowsCleared, cols = clear.colsCleared;
 const gain = op.kind === 'lines' ? op.axis === 'row' ? rows.length : op.axis === 'column' ? cols.length : rows.length + cols.length
  : op.kind === 'targetLine' ? Number((op.axis === 'row' ? rows : cols).includes(op.index)) : Number(rows.length > 0 && cols.length > 0);
 const target = op.kind === 'lines' ? op.count : 1;
 return progress.count + gain >= target ? { stage: progress.stage + 1, count: 0 } : { stage: progress.stage, count: progress.count + gain };
}

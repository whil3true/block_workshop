import type { Piece, PieceFamily } from './pieces';

export type CellState = PieceFamily | null;

export type BoardState = ReadonlyArray<ReadonlyArray<CellState>>;

export const BOARD_SIZE = 10;

export function createEmptyBoard(): BoardState {
  return Array.from(
    { length: BOARD_SIZE },
    () => Array.from({ length: BOARD_SIZE }, () => null as CellState),
  );
}

export function canPlace(
  board: BoardState,
  piece: Piece,
  anchorRow: number,
  anchorCol: number,
): boolean {
  for (const [r, c] of piece.cells) {
    const row = anchorRow + r;
    const col = anchorCol + c;
    if (row < 0 || row >= BOARD_SIZE) return false;
    if (col < 0 || col >= BOARD_SIZE) return false;
    const boardRow = board[row];
    if (!boardRow) return false;
    if (boardRow[col] !== null) return false;
  }
  return true;
}

export function applyPlacement(
  board: BoardState,
  piece: Piece,
  anchorRow: number,
  anchorCol: number,
): BoardState {
  if (!canPlace(board, piece, anchorRow, anchorCol)) {
    throw new Error(
      `applyPlacement: piece "${piece.id}" does not fit at (${anchorRow}, ${anchorCol})`,
    );
  }
  const next: CellState[][] = board.map((row) => row.slice());
  for (const [r, c] of piece.cells) {
    const row = next[anchorRow + r];
    if (row) row[anchorCol + c] = piece.family;
  }
  return next;
}

export type ClearResult = {
  readonly board: BoardState;
  readonly rowsCleared: ReadonlyArray<number>;
  readonly colsCleared: ReadonlyArray<number>;
};

/** Per-move line-clear bonus from SPEC §5.2. `L` is `rowsCleared + colsCleared`
 *  in a single placement; negative values are floored to 0 defensively. */
export function lineBonus(L: number): number {
  if (L <= 0) return 0;
  if (L === 1) return 10;
  if (L === 2) return 30;
  if (L === 3) return 60;
  if (L === 4) return 120;
  if (L === 5) return 200;
  if (L === 6) return 300;
  return 300 + 50 * (L - 6);
}

/** Streak multiplier from SPEC §5.3. Applied to the line bonus only. */
export function streakMultiplier(streak: number): number {
  if (streak <= 1) return 1.0;
  return Math.min(1 + 0.25 * (streak - 1), 3.0);
}

/** Game-over predicate (SPEC §6). Returns true iff at least one non-null piece
 *  in `pieces` fits at some anchor on `board`. Short-circuits on the first hit. */
export function hasAnyLegalPlacement(
  board: BoardState,
  pieces: ReadonlyArray<Piece | null>,
): boolean {
  for (const piece of pieces) {
    if (!piece) continue;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (canPlace(board, piece, r, c)) return true;
      }
    }
  }
  return false;
}

export function resolveClears(board: BoardState): ClearResult {
  const rowsCleared: number[] = [];
  const colsCleared: number[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = board[r];
    if (!row) continue;
    let full = true;
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = row[c];
      if (cell === null || cell === undefined) {
        full = false;
        break;
      }
    }
    if (full) rowsCleared.push(r);
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      const cell = board[r]?.[c];
      if (cell === null || cell === undefined) {
        full = false;
        break;
      }
    }
    if (full) colsCleared.push(c);
  }

  const rowSet = new Set(rowsCleared);
  const colSet = new Set(colsCleared);
  const next: CellState[][] = board.map((row, r) =>
    row.map((cell, c) => (rowSet.has(r) || colSet.has(c) ? null : cell)),
  );

  return { board: next, rowsCleared, colsCleared };
}

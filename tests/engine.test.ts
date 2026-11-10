import { describe, it, expect } from 'vitest';
import {
  createEmptyBoard,
  canPlace,
  applyPlacement,
  resolveClears,
  lineBonus,
  streakMultiplier,
  hasAnyLegalPlacement,
  type BoardState,
  type CellState,
} from '../src/engine';
import { CATALOG, type Piece, type PieceFamily } from '../src/pieces';

function pieceById(id: string): Piece {
  const p = CATALOG.find((x) => x.id === id);
  if (!p) throw new Error(`piece "${id}" not found in CATALOG`);
  return p;
}

function withFilled(filled: ReadonlyArray<readonly [number, number, PieceFamily]>): BoardState {
  const grid: CellState[][] = Array.from(
    { length: 10 },
    () => Array.from({ length: 10 }, () => null) as CellState[],
  );
  for (const [r, c, fam] of filled) {
    const row = grid[r];
    if (row) row[c] = fam;
  }
  return grid;
}

describe('createEmptyBoard()', () => {
  it('returns a 10x10 grid', () => {
    const board = createEmptyBoard();
    expect(board.length).toBe(10);
    for (const row of board) {
      expect(row.length).toBe(10);
    }
  });

  it('starts with every cell null', () => {
    const board = createEmptyBoard();
    for (const row of board) {
      for (const cell of row) {
        expect(cell).toBeNull();
      }
    }
  });

  it('returns independent grids and rows on each call', () => {
    const a = createEmptyBoard();
    const b = createEmptyBoard();
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
    expect(a[5]).not.toBe(b[5]);
  });
});

describe('canPlace() — bounds on empty board', () => {
  const empty = createEmptyBoard();

  it('accepts single at every interior anchor', () => {
    const single = pieceById('single');
    for (const [r, c] of [[0, 0], [9, 9], [5, 5], [3, 7]] as ReadonlyArray<readonly [number, number]>) {
      expect(canPlace(empty, single, r, c), `single@(${r},${c})`).toBe(true);
    }
  });

  it('rejects single at out-of-bounds anchors', () => {
    const single = pieceById('single');
    expect(canPlace(empty, single, -1, 0)).toBe(false);
    expect(canPlace(empty, single, 0, -1)).toBe(false);
    expect(canPlace(empty, single, 10, 0)).toBe(false);
    expect(canPlace(empty, single, 0, 10)).toBe(false);
  });

  it('penta-h fits up to column 5', () => {
    const piece = pieceById('penta-h');
    expect(canPlace(empty, piece, 0, 0)).toBe(true);
    expect(canPlace(empty, piece, 0, 5)).toBe(true);
    expect(canPlace(empty, piece, 0, 6)).toBe(false);
  });

  it('penta-v fits up to row 5', () => {
    const piece = pieceById('penta-v');
    expect(canPlace(empty, piece, 0, 0)).toBe(true);
    expect(canPlace(empty, piece, 5, 0)).toBe(true);
    expect(canPlace(empty, piece, 6, 0)).toBe(false);
  });

  it('square-3 fits up to (7,7)', () => {
    const sq3 = pieceById('square-3');
    expect(canPlace(empty, sq3, 0, 0)).toBe(true);
    expect(canPlace(empty, sq3, 7, 7)).toBe(true);
    expect(canPlace(empty, sq3, 8, 0)).toBe(false);
    expect(canPlace(empty, sq3, 0, 8)).toBe(false);
  });

  it('l2-ne respects its 2x2 bbox boundaries', () => {
    const piece = pieceById('l2-ne');
    expect(canPlace(empty, piece, 0, 8)).toBe(true);
    expect(canPlace(empty, piece, 0, 9)).toBe(false);
    expect(canPlace(empty, piece, 8, 0)).toBe(true);
    expect(canPlace(empty, piece, 9, 0)).toBe(false);
  });
});

describe('canPlace() — overlap', () => {
  it('rejects a single placed on a filled cell', () => {
    const board = withFilled([[3, 3, 'single']]);
    expect(canPlace(board, pieceById('single'), 3, 3)).toBe(false);
    expect(canPlace(board, pieceById('single'), 3, 4)).toBe(true);
  });

  it('rejects a multi-cell piece overlapping a single filled cell', () => {
    const board = withFilled([[4, 4, 'line']]);
    expect(canPlace(board, pieceById('square-2'), 3, 3)).toBe(false);
  });

  it('accepts placement next to a filled region', () => {
    const board = withFilled([[5, 5, 'sq2']]);
    expect(canPlace(board, pieceById('single'), 5, 6)).toBe(true);
    expect(canPlace(board, pieceById('domino-h'), 5, 6)).toBe(true);
  });

  it('ignores cells that are in the bbox but not in the piece', () => {
    // l2-nw has cells (0,1), (1,0), (1,1) — the (0,0) corner of the bbox is empty.
    // Filling board (0,0) must NOT prevent placement of l2-nw at anchor (0,0).
    const board = withFilled([[0, 0, 'single']]);
    expect(canPlace(board, pieceById('l2-nw'), 0, 0)).toBe(true);
  });

  it('ignores l3 bbox holes (sparse 3x3 piece)', () => {
    // l3-ne has cells (0,0),(1,0),(2,0),(2,1),(2,2). The other four bbox
    // cells — (0,1), (0,2), (1,1), (1,2) — are not part of the piece.
    const board = withFilled([
      [0, 1, 'single'],
      [0, 2, 'line'],
      [1, 1, 'sq2'],
      [1, 2, 'sq3'],
    ]);
    expect(canPlace(board, pieceById('l3-ne'), 0, 0)).toBe(true);
  });
});

describe('canPlace() — purity', () => {
  it('does not mutate the board across many calls', () => {
    const board = withFilled([
      [0, 0, 'single'],
      [5, 5, 'sq3'],
    ]);
    const snapshot = JSON.parse(JSON.stringify(board));

    for (const piece of CATALOG) {
      for (let r = -1; r < 11; r++) {
        for (let c = -1; c < 11; c++) {
          canPlace(board, piece, r, c);
        }
      }
    }

    expect(JSON.parse(JSON.stringify(board))).toEqual(snapshot);
  });
});

describe('applyPlacement()', () => {
  it('returns a different top-level board reference', () => {
    const before = createEmptyBoard();
    const after = applyPlacement(before, pieceById('single'), 0, 0);
    expect(after).not.toBe(before);
  });

  it('fills the single piece cell with its family', () => {
    const before = createEmptyBoard();
    const after = applyPlacement(before, pieceById('single'), 3, 3);
    expect(after[3]?.[3]).toBe('single');
  });

  it('fills exactly the cells of a square-2 with its family', () => {
    const before = createEmptyBoard();
    const after = applyPlacement(before, pieceById('square-2'), 4, 5);
    expect(after[4]?.[5]).toBe('sq2');
    expect(after[4]?.[6]).toBe('sq2');
    expect(after[5]?.[5]).toBe('sq2');
    expect(after[5]?.[6]).toBe('sq2');
  });

  it('only fills piece cells, not bbox holes (l3-ne)', () => {
    const before = createEmptyBoard();
    const after = applyPlacement(before, pieceById('l3-ne'), 0, 0);
    // Piece cells filled.
    expect(after[0]?.[0]).toBe('l3');
    expect(after[1]?.[0]).toBe('l3');
    expect(after[2]?.[0]).toBe('l3');
    expect(after[2]?.[1]).toBe('l3');
    expect(after[2]?.[2]).toBe('l3');
    // Bbox holes left null.
    expect(after[0]?.[1]).toBeNull();
    expect(after[0]?.[2]).toBeNull();
    expect(after[1]?.[1]).toBeNull();
    expect(after[1]?.[2]).toBeNull();
  });

  it('leaves cells outside the piece unchanged', () => {
    const before = withFilled([[9, 9, 'sq3']]);
    const after = applyPlacement(before, pieceById('single'), 0, 0);
    expect(after[9]?.[9]).toBe('sq3');
    expect(after[5]?.[5]).toBeNull();
  });

  it('does not mutate the input board on a successful placement', () => {
    const before = withFilled([[7, 7, 'line']]);
    const snapshot = JSON.parse(JSON.stringify(before));
    applyPlacement(before, pieceById('square-3'), 0, 0);
    expect(JSON.parse(JSON.stringify(before))).toEqual(snapshot);
  });

  it('throws when the placement is out of bounds', () => {
    const board = createEmptyBoard();
    expect(() => applyPlacement(board, pieceById('single'), 10, 0)).toThrow();
    expect(() => applyPlacement(board, pieceById('penta-h'), 0, 6)).toThrow();
  });

  it('throws when the placement overlaps an existing piece', () => {
    const board = withFilled([[3, 3, 'single']]);
    expect(() => applyPlacement(board, pieceById('square-2'), 3, 3)).toThrow();
  });

  it('throw message contains the piece id and anchor', () => {
    const board = createEmptyBoard();
    try {
      applyPlacement(board, pieceById('penta-h'), 0, 7);
      expect.fail('expected applyPlacement to throw');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toMatch(/penta-h/);
      expect(msg).toMatch(/0/);
      expect(msg).toMatch(/7/);
    }
  });

  it('does not mutate the input board on a thrown placement', () => {
    const board = withFilled([[3, 3, 'single']]);
    const snapshot = JSON.parse(JSON.stringify(board));
    expect(() =>
      applyPlacement(board, pieceById('square-2'), 3, 3),
    ).toThrow();
    expect(JSON.parse(JSON.stringify(board))).toEqual(snapshot);
  });

  it('composes: two non-overlapping placements both land, no intermediate leakage', () => {
    const board0 = createEmptyBoard();
    const board1 = applyPlacement(board0, pieceById('square-2'), 0, 0);
    const board1Snapshot = JSON.parse(JSON.stringify(board1));
    const board2 = applyPlacement(board1, pieceById('square-2'), 5, 5);

    // First piece still present in board2.
    expect(board2[0]?.[0]).toBe('sq2');
    expect(board2[1]?.[1]).toBe('sq2');
    // Second piece present.
    expect(board2[5]?.[5]).toBe('sq2');
    expect(board2[6]?.[6]).toBe('sq2');
    // Intermediate board untouched by the second placement (full deep equality).
    expect(JSON.parse(JSON.stringify(board1))).toEqual(board1Snapshot);
  });
});

function fillRow(board: BoardState, row: number, family: 'sq2' | 'sq3' | 'l3' | 'line' | 'single' = 'line'): BoardState {
  const next: CellState[][] = board.map((r) => r.slice());
  const rowArr = next[row];
  if (!rowArr) throw new Error(`row ${row} missing`);
  for (let c = 0; c < 10; c++) rowArr[c] = family;
  return next;
}

function fillCol(board: BoardState, col: number, family: 'sq2' | 'sq3' | 'l3' | 'line' | 'single' = 'line'): BoardState {
  const next: CellState[][] = board.map((r) => r.slice());
  for (let r = 0; r < 10; r++) {
    const row = next[r];
    if (row) row[col] = family;
  }
  return next;
}

function fillEvery(board: BoardState, family: 'sq2' | 'sq3' | 'l3' | 'line' | 'single' = 'sq2'): BoardState {
  return board.map(() =>
    Array.from({ length: 10 }, () => family) as CellState[],
  );
}

describe('resolveClears()', () => {
  it('clears nothing on an empty board', () => {
    const before = createEmptyBoard();
    const { board, rowsCleared, colsCleared } = resolveClears(before);
    expect(rowsCleared).toEqual([]);
    expect(colsCleared).toEqual([]);
    expect(JSON.parse(JSON.stringify(board))).toEqual(
      JSON.parse(JSON.stringify(before)),
    );
  });

  it('returns a different top-level board reference even when nothing clears', () => {
    const before = createEmptyBoard();
    const { board } = resolveClears(before);
    expect(board).not.toBe(before);
  });

  it('clears a single full row', () => {
    const before = fillRow(createEmptyBoard(), 4, 'line');
    const { board, rowsCleared, colsCleared } = resolveClears(before);
    expect(rowsCleared).toEqual([4]);
    expect(colsCleared).toEqual([]);
    for (let c = 0; c < 10; c++) {
      expect(board[4]?.[c]).toBeNull();
    }
    // Other rows remain empty.
    for (let r = 0; r < 10; r++) {
      if (r === 4) continue;
      for (let c = 0; c < 10; c++) {
        expect(board[r]?.[c]).toBeNull();
      }
    }
  });

  it('clears a single full column', () => {
    const before = fillCol(createEmptyBoard(), 7, 'sq3');
    const { board, rowsCleared, colsCleared } = resolveClears(before);
    expect(rowsCleared).toEqual([]);
    expect(colsCleared).toEqual([7]);
    for (let r = 0; r < 10; r++) {
      expect(board[r]?.[7]).toBeNull();
    }
  });

  it('clears a row and a column simultaneously, intersection nulled once', () => {
    let before = fillRow(createEmptyBoard(), 2, 'sq2');
    before = fillCol(before, 5, 'l3');
    const { board, rowsCleared, colsCleared } = resolveClears(before);
    expect(rowsCleared).toEqual([2]);
    expect(colsCleared).toEqual([5]);
    // Whole row 2 and whole col 5 are null in the result.
    for (let c = 0; c < 10; c++) expect(board[2]?.[c]).toBeNull();
    for (let r = 0; r < 10; r++) expect(board[r]?.[5]).toBeNull();
    // Cells outside row 2 / col 5 unchanged: empty before, empty after.
    expect(board[0]?.[0]).toBeNull();
    expect(board[9]?.[9]).toBeNull();
  });

  it('clears multiple rows and reports them sorted ascending', () => {
    let before = fillRow(createEmptyBoard(), 9);
    before = fillRow(before, 1);
    before = fillRow(before, 4);
    const { board, rowsCleared, colsCleared } = resolveClears(before);
    expect(rowsCleared).toEqual([1, 4, 9]);
    expect(colsCleared).toEqual([]);
    for (const r of [1, 4, 9]) {
      for (let c = 0; c < 10; c++) expect(board[r]?.[c]).toBeNull();
    }
  });

  it('clears multiple columns and reports them sorted ascending', () => {
    let before = fillCol(createEmptyBoard(), 5);
    before = fillCol(before, 0);
    const { board, rowsCleared, colsCleared } = resolveClears(before);
    expect(rowsCleared).toEqual([]);
    expect(colsCleared).toEqual([0, 5]);
    for (const c of [0, 5]) {
      for (let r = 0; r < 10; r++) expect(board[r]?.[c]).toBeNull();
    }
  });

  it('clears every row and column on a full board (perfect clear)', () => {
    const before = fillEvery(createEmptyBoard(), 'sq2');
    const { board, rowsCleared, colsCleared } = resolveClears(before);
    expect(rowsCleared).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(colsCleared).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const row of board) {
      for (const cell of row) {
        expect(cell).toBeNull();
      }
    }
  });

  it('does not mutate the input board', () => {
    const before = fillRow(createEmptyBoard(), 4, 'line');
    const snapshot = JSON.parse(JSON.stringify(before));
    resolveClears(before);
    expect(JSON.parse(JSON.stringify(before))).toEqual(snapshot);
  });
});

describe('lineBonus()', () => {
  it.each([
    [0, 0],
    [1, 10],
    [2, 30],
    [3, 60],
    [4, 120],
    [5, 200],
    [6, 300],
    [7, 350],
    [10, 500],
    [-1, 0],
  ])('L=%i → %i', (L, expected) => {
    expect(lineBonus(L)).toBe(expected);
  });
});

describe('streakMultiplier()', () => {
  it.each([
    [0, 1.0],
    [1, 1.0],
    [2, 1.25],
    [3, 1.5],
    [5, 2.0],
    [9, 3.0],
    [20, 3.0],
    [-5, 1.0],
  ])('streak=%i → %f', (streak, expected) => {
    expect(streakMultiplier(streak)).toBe(expected);
  });
});

describe('hasAnyLegalPlacement()', () => {
  it('is true when any non-null piece fits on an empty board', () => {
    const board = createEmptyBoard();
    expect(hasAnyLegalPlacement(board, [pieceById('square-3')])).toBe(true);
  });

  it('is false when the tray contains only nulls', () => {
    const board = createEmptyBoard();
    expect(hasAnyLegalPlacement(board, [null, null, null])).toBe(false);
  });

  it('is false on a fully filled board for any piece', () => {
    const board = fillEvery(createEmptyBoard(), 'sq2');
    for (const piece of CATALOG) {
      expect(hasAnyLegalPlacement(board, [piece]), piece.id).toBe(false);
    }
  });

  it('returns true if at least one of the tray pieces fits', () => {
    // Hand-craft a board with only (0, 0) empty — only the single piece fits.
    const board: CellState[][] = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => 'sq2') as CellState[],
    );
    const row0 = board[0];
    if (row0) row0[0] = null;

    expect(
      hasAnyLegalPlacement(board, [
        pieceById('square-3'),
        pieceById('single'),
        null,
      ]),
    ).toBe(true);
  });

  it('returns false when no piece in the tray can fit', () => {
    const board: CellState[][] = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => 'sq2') as CellState[],
    );
    const row0 = board[0];
    if (row0) row0[0] = null;

    // Only (0,0) is empty; only `single` fits there. Tray has no single.
    expect(
      hasAnyLegalPlacement(board, [
        pieceById('square-3'),
        pieceById('penta-h'),
        null,
      ]),
    ).toBe(false);
  });
});

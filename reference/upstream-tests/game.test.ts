import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
});
import { createGame, TRAY_SIZE, type GameApi } from '../src/game';
import { CATALOG, sampleTray } from '../src/pieces';
import {
  canPlace,
  type BoardState,
  type CellState,
} from '../src/engine';
import { mulberry32 } from './helpers';

function fullBoard(family: 'sq2' | 'sq3' | 'line' | 'l3' = 'sq2'): BoardState {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => family) as CellState[],
  );
}


function trayIds(game: GameApi): Array<string | null> {
  return game.trayPieces.map((p) => p?.id ?? null);
}

function findSafeAnchor(game: GameApi, slotIndex: number): readonly [number, number] {
  const piece = game.trayPieces[slotIndex];
  if (!piece) throw new Error(`slot ${slotIndex} is empty`);
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (canPlace(game.boardState, piece, r, c)) return [r, c];
    }
  }
  throw new Error(`no legal anchor for piece in slot ${slotIndex}`);
}

/** Brute-force a deterministic seed whose initial tray (as the game would
 *  actually deal it via `sampleTray`) matches `predicate`. */
function findSeedWithPieces(
  predicate: (ids: ReadonlyArray<string>) => boolean,
  limit = 50000,
): number {
  for (let seed = 1; seed < limit; seed++) {
    const ids = sampleTray(mulberry32(seed), TRAY_SIZE).map((p) => p.id);
    if (predicate(ids)) return seed;
  }
  throw new Error(`no seed found within ${limit} tries`);
}

describe('createGame() — construction', () => {
  it('starts with an empty board', () => {
    const game = createGame({ rng: mulberry32(1) });
    for (const row of game.boardState) {
      for (const cell of row) {
        expect(cell).toBeNull();
      }
    }
  });

  it('provides TRAY_SIZE pieces from CATALOG in the tray', () => {
    const game = createGame({ rng: mulberry32(1) });
    expect(game.trayPieces.length).toBe(TRAY_SIZE);
    const ids = new Set(CATALOG.map((p) => p.id));
    for (const piece of game.trayPieces) {
      expect(piece).not.toBeNull();
      if (piece) expect(ids.has(piece.id)).toBe(true);
    }
  });

  it('is deterministic for a given rng seed', () => {
    const a = createGame({ rng: mulberry32(42) });
    const b = createGame({ rng: mulberry32(42) });
    expect(trayIds(a)).toEqual(trayIds(b));
  });
});

describe('mount()', () => {
  it('appends board then tray under the root', () => {
    const game = createGame({ rng: mulberry32(1) });
    const root = document.createElement('div');
    game.mount(root);
    const children = Array.from(root.children);
    const boardIdx = children.findIndex((c) => c.classList.contains('board'));
    const trayIdx = children.findIndex((c) => c.classList.contains('tray'));
    expect(boardIdx).toBeGreaterThanOrEqual(0);
    expect(trayIdx).toBeGreaterThan(boardIdx);
  });

  it('mounts pieces into the tray DOM that match trayPieces', () => {
    const game = createGame({ rng: mulberry32(1) });
    const root = document.createElement('div');
    game.mount(root);
    const slots = root.querySelectorAll<HTMLElement>('.tray__slot');
    for (let i = 0; i < TRAY_SIZE; i++) {
      const expected = game.trayPieces[i]?.id;
      expect(slots[i]?.dataset['pieceId']).toBe(expected);
    }
  });
});

describe('place() — happy path', () => {
  it('updates the board state with the placed piece', () => {
    const game = createGame({ rng: mulberry32(1) });
    game.mount(document.createElement('div'));
    const piece = game.trayPieces[0];
    if (!piece) throw new Error('expected a piece in slot 0');

    game.place(0, 0, 0);

    for (const [r, c] of piece.cells) {
      expect(game.boardState[r]?.[c]).toBe(piece.family);
    }
  });

  it('clears the slot DOM after a placement', () => {
    const game = createGame({ rng: mulberry32(1) });
    const root = document.createElement('div');
    game.mount(root);

    game.place(0, 0, 0);

    const slot0 = root.querySelectorAll<HTMLElement>('.tray__slot')[0];
    expect(slot0?.dataset['pieceId']).toBeUndefined();
    expect(slot0?.querySelectorAll('.tray__piece-cell').length).toBe(0);
  });

  it('reflects the placement on the board DOM', () => {
    const game = createGame({ rng: mulberry32(1) });
    const root = document.createElement('div');
    game.mount(root);
    const piece = game.trayPieces[0];
    if (!piece) throw new Error('expected a piece in slot 0');

    game.place(0, 0, 0);

    const firstCell = piece.cells[0];
    if (!firstCell) throw new Error('piece has no cells');
    const [r, c] = firstCell;
    const cellEl = root.querySelector<HTMLElement>(
      `.board__cell[data-row="${r}"][data-col="${c}"]`,
    );
    expect(cellEl?.dataset['state']).toBe('filled');
    expect(cellEl?.style.getPropertyValue('--piece-color')).toBe(
      `var(--color-piece-${piece.family})`,
    );
  });

  it('sets trayPieces[slotIndex] to null after placement', () => {
    const game = createGame({ rng: mulberry32(1) });
    game.mount(document.createElement('div'));
    game.place(0, 0, 0);
    expect(game.trayPieces[0]).toBeNull();
  });
});

describe('place() — rejections', () => {
  it('throws when slotIndex is out of range', () => {
    const game = createGame({ rng: mulberry32(1) });
    game.mount(document.createElement('div'));
    expect(() => game.place(-1, 0, 0)).toThrow();
    expect(() => game.place(TRAY_SIZE, 0, 0)).toThrow();
  });

  it('throws when the slot is already empty', () => {
    const game = createGame({ rng: mulberry32(1) });
    game.mount(document.createElement('div'));
    game.place(0, 0, 0);
    expect(() => game.place(0, 5, 5)).toThrow();
  });

  it('throws on illegal placement (out of bounds)', () => {
    const game = createGame({ rng: mulberry32(1) });
    game.mount(document.createElement('div'));
    expect(() => game.place(0, 10, 10)).toThrow();
  });
});

describe('place() — clears', () => {
  it('clears a completed row from boardState and DOM', () => {
    const seed = findSeedWithPieces(
      ([a, b]) => a === 'penta-h' && b === 'penta-h',
    );
    const game = createGame({ rng: mulberry32(seed) });
    const root = document.createElement('div');
    game.mount(root);

    game.place(0, 0, 0); // fills (0,0)..(0,4)
    game.place(1, 0, 5); // fills (0,5)..(0,9) — row 0 now full and cleared

    for (let c = 0; c < 10; c++) {
      expect(game.boardState[0]?.[c]).toBeNull();
    }

    const cells = root.querySelectorAll<HTMLElement>(
      '.board__cell[data-row="0"]',
    );
    expect(cells.length).toBe(10);
    for (const cell of cells) {
      expect(cell.dataset['state']).toBe('empty');
      expect(cell.style.getPropertyValue('--piece-color')).toBe('');
    }
  });

  it('does not clear when no row or column is complete', () => {
    const game = createGame({ rng: mulberry32(1) });
    game.mount(document.createElement('div'));
    const piece = game.trayPieces[0];
    if (!piece) throw new Error('no piece');

    game.place(0, 0, 0);

    for (const [r, c] of piece.cells) {
      expect(game.boardState[r]?.[c]).toBe(piece.family);
    }
  });

  it('respects refill timing after a clearing placement', () => {
    const seed = findSeedWithPieces(
      ([a, b]) => a === 'penta-h' && b === 'penta-h',
    );
    const game = createGame({ rng: mulberry32(seed) });
    game.mount(document.createElement('div'));

    const piece2Before = game.trayPieces[2];
    if (!piece2Before) throw new Error('no piece in slot 2');

    game.place(0, 0, 0);
    game.place(1, 0, 5); // clears row 0 — slot 2 still has its piece

    expect(game.trayPieces[0]).toBeNull();
    expect(game.trayPieces[1]).toBeNull();
    expect(game.trayPieces[2]?.id).toBe(piece2Before.id);
  });
});

describe('Game — scoring', () => {
  it('starts at score=0, streak=0', () => {
    const game = createGame({ rng: mulberry32(1) });
    expect(game.score).toBe(0);
    expect(game.streak).toBe(0);
  });

  it('credits placement points without any clear', () => {
    const game = createGame({ rng: mulberry32(1) });
    game.mount(document.createElement('div'));
    const piece = game.trayPieces[0];
    if (!piece) throw new Error('no piece');
    game.place(0, 0, 0);
    expect(game.score).toBe(piece.cells.length);
    expect(game.streak).toBe(0);
  });

  // Helper: pick the slot indices that hold a penta-h in the current tray.
  function pentaHSlots(game: GameApi): [number, number] {
    const idx = game.trayPieces
      .map((p, i) => (p?.id === 'penta-h' ? i : -1))
      .filter((i) => i >= 0);
    if (idx.length < 2) throw new Error('expected ≥2 penta-h in the tray');
    return [idx[0]!, idx[1]!];
  }

  it('SPEC §5.6 example: two penta-h that clear a row yield total 320', () => {
    const seed = findSeedWithPieces(
      (ids) => ids.filter((id) => id === 'penta-h').length >= 2,
    );
    const game = createGame({ rng: mulberry32(seed) });
    game.mount(document.createElement('div'));
    const [a, b] = pentaHSlots(game);

    game.place(a, 0, 0); // 5 cells, no clear → +5
    expect(game.score).toBe(5);
    expect(game.streak).toBe(0);

    game.place(b, 0, 5); // 5 cells, L=1, streak→1, ×1.0, perfect-clear bonus
    // 5 (prev) + 5 (placement) + round(10 × 1.0) (bonus) + 300 (perfect) = 320.
    expect(game.score).toBe(320);
    expect(game.streak).toBe(1);
  });

  it('resets streak to 0 after a non-clearing placement', () => {
    const seed = findSeedWithPieces(
      (ids) => ids.filter((id) => id === 'penta-h').length >= 2,
    );
    const game = createGame({ rng: mulberry32(seed) });
    game.mount(document.createElement('div'));
    const [a, b] = pentaHSlots(game);
    const third = [0, 1, 2].find((i) => i !== a && i !== b)!;

    game.place(a, 0, 0);
    game.place(b, 0, 5); // perfect clear, streak=1
    expect(game.streak).toBe(1);

    const piece2 = game.trayPieces[third];
    if (!piece2) throw new Error('no piece in third slot');
    const [r, c] = findSafeAnchor(game, third);
    const scoreBefore = game.score;

    game.place(third, r, c);

    expect(game.streak).toBe(0);
    expect(game.score).toBe(scoreBefore + piece2.cells.length);
  });

  it('does not change score or streak on illegal placement', () => {
    const game = createGame({ rng: mulberry32(1) });
    game.mount(document.createElement('div'));
    expect(() => game.place(0, 10, 10)).toThrow();
    expect(game.score).toBe(0);
    expect(game.streak).toBe(0);
  });
});

describe('place() — illegal placements preserve state', () => {
  it('does not mutate board, tray, or DOM when placement throws', () => {
    const game = createGame({ rng: mulberry32(1) });
    const root = document.createElement('div');
    game.mount(root);

    const boardBefore = JSON.parse(JSON.stringify(game.boardState));
    const trayBefore = game.trayPieces.map((p) => p?.id ?? null);

    expect(() => game.place(0, 10, 10)).toThrow();

    expect(JSON.parse(JSON.stringify(game.boardState))).toEqual(boardBefore);
    expect(game.trayPieces.map((p) => p?.id ?? null)).toEqual(trayBefore);
    expect(
      root.querySelectorAll('.board__cell[data-state="filled"]').length,
    ).toBe(0);
  });
});

describe('Game — persistence', () => {

  it('starts with bestScore=0 when storage is empty', () => {
    const game = createGame({ rng: mulberry32(1) });
    expect(game.bestScore).toBe(0);
  });

  it('updates and persists bestScore after a higher score is reached', () => {
    const game = createGame({ rng: mulberry32(1) });
    game.mount(document.createElement('div'));
    const piece = game.trayPieces[0];
    if (!piece) throw new Error('no piece');
    game.place(0, 0, 0);
    expect(game.bestScore).toBe(game.score);
    expect(localStorage.getItem('blockly:bestScore')).toBe(String(game.score));
  });

  it('preserves bestScore across newGame()', () => {
    const game = createGame({ rng: mulberry32(1) });
    game.mount(document.createElement('div'));
    game.place(0, 0, 0);
    const best = game.bestScore;
    expect(best).toBeGreaterThan(0);
    game.newGame();
    expect(game.bestScore).toBe(best);
    expect(game.score).toBe(0);
  });

  it('reads persisted bestScore on a fresh createGame', () => {
    localStorage.setItem('blockly:bestScore', '777');
    const game = createGame({ rng: mulberry32(1) });
    expect(game.bestScore).toBe(777);
  });

  it('resumes from lastGame snapshot on a fresh createGame', () => {
    const game1 = createGame({ rng: mulberry32(1) });
    game1.mount(document.createElement('div'));
    const piece0 = game1.trayPieces[0];
    if (!piece0) throw new Error('no piece');
    game1.place(0, 0, 0);

    const expectedScore = game1.score;
    const expectedBoard = JSON.parse(JSON.stringify(game1.boardState));

    const game2 = createGame({ rng: mulberry32(999) });
    expect(game2.score).toBe(expectedScore);
    expect(JSON.parse(JSON.stringify(game2.boardState))).toEqual(expectedBoard);
    expect(game2.trayPieces[0]).toBeNull();
  });

  it('does not resume after gameOver (snapshot is cleared)', () => {
    const game1 = createGame({
      rng: mulberry32(1),
      initialBoard: fullBoard(),
    });
    expect(game1.gameOver).toBe(true);
    // gameOver at construction means the snapshot was already cleared (or
    // never written); a fresh createGame should NOT resume to a locked
    // state.
    const game2 = createGame({ rng: mulberry32(1) });
    expect(game2.gameOver).toBe(false);
    for (const row of game2.boardState) {
      for (const cell of row) {
        expect(cell).toBeNull();
      }
    }
  });

  it('clears the snapshot on newGame()', () => {
    const game1 = createGame({ rng: mulberry32(1) });
    game1.mount(document.createElement('div'));
    game1.place(0, 0, 0);
    expect(localStorage.getItem('blockly:lastGame')).not.toBeNull();

    game1.newGame();
    expect(localStorage.getItem('blockly:lastGame')).toBeNull();

    const game2 = createGame({ rng: mulberry32(1) });
    for (const row of game2.boardState) {
      for (const cell of row) {
        expect(cell).toBeNull();
      }
    }
  });

  it('drops unknown trayIds to null when resuming (catalog drift)', () => {
    // Hand-craft a snapshot containing one piece id that is not in the
    // catalog. The corresponding slot should resume as null.
    localStorage.setItem(
      'blockly:lastGame',
      JSON.stringify({
        board: Array.from({ length: 10 }, () =>
          Array.from({ length: 10 }, () => null),
        ),
        trayIds: ['single', 'not-a-piece', 'penta-h'],
        score: 0,
        streak: 0,
      }),
    );
    const game = createGame({ rng: mulberry32(1) });
    expect(game.trayPieces[0]?.id).toBe('single');
    expect(game.trayPieces[1]).toBeNull();
    expect(game.trayPieces[2]?.id).toBe('penta-h');
  });

  it('skips resume when an explicit initialBoard is provided', () => {
    const game1 = createGame({ rng: mulberry32(1) });
    game1.mount(document.createElement('div'));
    game1.place(0, 0, 0);
    expect(localStorage.getItem('blockly:lastGame')).not.toBeNull();

    const game2 = createGame({
      rng: mulberry32(1),
      initialBoard: fullBoard(),
    });
    expect(game2.gameOver).toBe(true);
  });
});

describe('Game — audio events', () => {
  type AudioEvent =
    | 'pickup'
    | 'place'
    | 'reject'
    | 'clear'
    | 'combo'
    | 'perfect'
    | 'gameOver';

  function recordingAudio(): {
    calls: AudioEvent[];
    api: {
      pickup: () => void;
      place: () => void;
      reject: () => void;
      clear: () => void;
      combo: () => void;
      perfect: () => void;
      gameOver: () => void;
      setMuted: (v: boolean) => void;
      isMuted: () => boolean;
      unlock: () => void;
    };
  } {
    const calls: AudioEvent[] = [];
    return {
      calls,
      api: {
        pickup: () => calls.push('pickup'),
        place: () => calls.push('place'),
        reject: () => calls.push('reject'),
        clear: () => calls.push('clear'),
        combo: () => calls.push('combo'),
        perfect: () => calls.push('perfect'),
        gameOver: () => calls.push('gameOver'),
        setMuted: () => {},
        isMuted: () => false,
        unlock: () => {},
      },
    };
  }

  function makeBoard(
    fills: ReadonlyArray<readonly [number, number, CellState]>,
  ): BoardState {
    const board: CellState[][] = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => null) as CellState[],
    );
    for (const [r, c, v] of fills) {
      const row = board[r];
      if (row) row[c] = v;
    }
    return board;
  }

  it('plays "place" on a non-clearing placement', () => {
    const rec = recordingAudio();
    const game = createGame({ rng: mulberry32(1), audio: rec.api });
    game.mount(document.createElement('div'));
    game.place(0, 0, 0);
    expect(rec.calls).toEqual(['place']);
  });

  it('plays "clear" on a single-line clear without perfect-clear', () => {
    const seed = findSeedWithPieces(([a]) => a === 'single');
    const fills: Array<[number, number, CellState]> = [];
    for (let c = 0; c < 9; c++) fills.push([0, c, 'sq2']);
    fills.push([5, 5, 'sq2']); // prevent perfect clear
    const rec = recordingAudio();
    const game = createGame({
      rng: mulberry32(seed),
      audio: rec.api,
      initialBoard: makeBoard(fills),
    });
    game.mount(document.createElement('div'));
    game.place(0, 0, 9);
    expect(rec.calls).toEqual(['clear']);
  });

  it('plays "combo" on a simultaneous row+column clear', () => {
    const seed = findSeedWithPieces(([a]) => a === 'single');
    const fills: Array<[number, number, CellState]> = [];
    for (let c = 0; c < 9; c++) fills.push([9, c, 'sq2']);
    for (let r = 0; r < 9; r++) fills.push([r, 9, 'sq2']);
    fills.push([5, 5, 'sq2']); // prevent perfect clear
    const rec = recordingAudio();
    const game = createGame({
      rng: mulberry32(seed),
      audio: rec.api,
      initialBoard: makeBoard(fills),
    });
    game.mount(document.createElement('div'));
    game.place(0, 9, 9);
    expect(rec.calls).toEqual(['combo']);
  });

  it('plays "perfect" when the placement empties the board', () => {
    const seed = findSeedWithPieces(([a]) => a === 'single');
    const fills: Array<[number, number, CellState]> = [];
    for (let c = 0; c < 9; c++) fills.push([0, c, 'sq2']);
    const rec = recordingAudio();
    const game = createGame({
      rng: mulberry32(seed),
      audio: rec.api,
      initialBoard: makeBoard(fills),
    });
    game.mount(document.createElement('div'));
    game.place(0, 0, 9);
    expect(rec.calls).toEqual(['perfect']);
  });

  it('plays "gameOver" when the placement locks the board', () => {
    const board: CellState[][] = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => 'sq2') as CellState[],
    );
    const holes: ReadonlyArray<readonly [number, number]> = [
      [0, 0], [1, 1], [2, 2], [3, 3], [4, 4],
      [5, 5], [6, 6], [7, 7], [8, 8], [9, 9],
      [5, 6], [6, 5],
      [5, 9], [6, 9], [9, 5], [9, 6],
    ];
    for (const [r, c] of holes) {
      const row = board[r];
      if (row) row[c] = null;
    }
    const blocked = new Set(['single', 'domino-h', 'domino-v']);
    const seed = findSeedWithPieces(
      ([a, b, c]) =>
        a === 'square-2' && !blocked.has(b ?? '') && !blocked.has(c ?? ''),
    );

    const rec = recordingAudio();
    const game = createGame({
      rng: mulberry32(seed),
      audio: rec.api,
      initialBoard: board,
    });
    game.mount(document.createElement('div'));
    game.place(0, 5, 5);
    expect(rec.calls).toEqual(['gameOver']);
  });
});

describe('Game — combo callout', () => {
  type AudioSpyApi = {
    pickup: () => void;
    place: () => void;
    reject: () => void;
    clear: () => void;
    combo: () => void;
    perfect: () => void;
    gameOver: () => void;
    setMuted: () => void;
    isMuted: () => boolean;
    unlock: () => void;
  };

  function silentAudio(): AudioSpyApi {
    return {
      pickup: () => {},
      place: () => {},
      reject: () => {},
      clear: () => {},
      combo: () => {},
      perfect: () => {},
      gameOver: () => {},
      setMuted: () => {},
      isMuted: () => false,
      unlock: () => {},
    };
  }

  function makeBoard(
    fills: ReadonlyArray<readonly [number, number, CellState]>,
  ): BoardState {
    const board: CellState[][] = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => null) as CellState[],
    );
    for (const [r, c, v] of fills) {
      const row = board[r];
      if (row) row[c] = v;
    }
    return board;
  }

  function setupComboScenario(): {
    game: GameApi;
    root: HTMLElement;
  } {
    const seed = findSeedWithPieces(([a]) => a === 'single');
    const fills: Array<[number, number, CellState]> = [];
    for (let c = 0; c < 9; c++) fills.push([9, c, 'sq2']);
    for (let r = 0; r < 9; r++) fills.push([r, 9, 'sq2']);
    fills.push([5, 5, 'sq2']);

    const game = createGame({
      rng: mulberry32(seed),
      audio: silentAudio(),
      initialBoard: makeBoard(fills),
    });
    const root = document.createElement('div');
    game.mount(root);
    return { game, root };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with a hidden combo callout', () => {
    const game = createGame({ rng: mulberry32(1), audio: silentAudio() });
    const root = document.createElement('div');
    game.mount(root);
    const callout = root.querySelector<HTMLElement>('.combo-callout');
    expect(callout).not.toBeNull();
    expect(callout?.dataset['visible']).toBe('false');
  });

  it('does not show the callout on a non-combo placement', () => {
    const game = createGame({ rng: mulberry32(1), audio: silentAudio() });
    const root = document.createElement('div');
    game.mount(root);
    game.place(0, 0, 0);
    const callout = root.querySelector<HTMLElement>('.combo-callout');
    expect(callout?.dataset['visible']).toBe('false');
  });

  it('shows the callout with the streak count on a combo placement', () => {
    const { game, root } = setupComboScenario();
    game.place(0, 9, 9);
    const callout = root.querySelector<HTMLElement>('.combo-callout');
    expect(callout?.dataset['visible']).toBe('true');
    expect(callout?.textContent).toBe(`COMBO ×${game.streak}`);
  });

  it('hides the callout after ~900ms', () => {
    const { game, root } = setupComboScenario();
    game.place(0, 9, 9);
    const callout = root.querySelector<HTMLElement>('.combo-callout');
    expect(callout?.dataset['visible']).toBe('true');
    vi.advanceTimersByTime(1000);
    expect(callout?.dataset['visible']).toBe('false');
  });

  it('newGame() hides the callout immediately', () => {
    const { game, root } = setupComboScenario();
    game.place(0, 9, 9);
    const callout = root.querySelector<HTMLElement>('.combo-callout');
    expect(callout?.dataset['visible']).toBe('true');
    game.newGame();
    expect(callout?.dataset['visible']).toBe('false');
  });
});

describe('Game — game over', () => {
  it('starts with gameOver=false on an empty board', () => {
    const game = createGame({ rng: mulberry32(1) });
    expect(game.gameOver).toBe(false);
  });

  it('starts with gameOver=true when initialBoard has no legal placement', () => {
    const game = createGame({ rng: mulberry32(1), initialBoard: fullBoard() });
    expect(game.gameOver).toBe(true);
  });

  it('throws on place() when gameOver is true', () => {
    const game = createGame({ rng: mulberry32(1), initialBoard: fullBoard() });
    game.mount(document.createElement('div'));
    expect(() => game.place(0, 0, 0)).toThrow(/game over/i);
  });

  it('flips gameOver to true after a placement leaves no legal moves', () => {
    // Construct a near-locked board where every row and column already has
    // at least one empty cell (so resolveClears triggers nothing). The
    // empties are:
    //   - a diagonal: (0,0)..(9,9) — guarantees per-row, per-column gaps
    //   - a 2x2 hole around (5,5)-(6,6) for the test piece
    //   - tails at (5,9), (6,9), (9,5), (9,6) so placing the 2x2 doesn't
    //     fully fill the rows/cols it touches
    // After placing a square-2 at (5,5), the remaining empties are
    // isolated singletons (+ one vertical pair (5,9)-(6,9) and one
    // horizontal pair (9,5)-(9,6)). Only single + domino-h + domino-v can
    // fit; the seed search bars those from slots 1 and 2.
    const board: CellState[][] = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => 'sq2') as CellState[],
    );
    const holes: ReadonlyArray<readonly [number, number]> = [
      // diagonal (rows and cols all keep one empty)
      [0, 0], [1, 1], [2, 2], [3, 3], [4, 4],
      [5, 5], [6, 6], [7, 7], [8, 8], [9, 9],
      // 2x2 hole completes around the diagonal at (5,5)-(6,6)
      [5, 6], [6, 5],
      // tails so the 2x2 placement doesn't complete its rows/cols
      [5, 9], [6, 9], [9, 5], [9, 6],
    ];
    for (const [r, c] of holes) {
      const row = board[r];
      if (row) row[c] = null;
    }

    const blocked = new Set(['single', 'domino-h', 'domino-v']);
    const seed = findSeedWithPieces(
      ([a, b, c]) =>
        a === 'square-2' && !blocked.has(b ?? '') && !blocked.has(c ?? ''),
    );
    const game = createGame({ rng: mulberry32(seed), initialBoard: board });
    game.mount(document.createElement('div'));

    expect(game.gameOver).toBe(false);
    game.place(0, 5, 5);
    expect(game.gameOver).toBe(true);
  });

  it('newGame() resets board, score, streak, gameOver, and tray', () => {
    const game = createGame({ rng: mulberry32(1), initialBoard: fullBoard() });
    game.mount(document.createElement('div'));
    expect(game.gameOver).toBe(true);

    game.newGame();
    expect(game.gameOver).toBe(false);
    expect(game.score).toBe(0);
    expect(game.streak).toBe(0);
    for (const row of game.boardState) {
      for (const cell of row) {
        expect(cell).toBeNull();
      }
    }
    expect(game.trayPieces.length).toBe(TRAY_SIZE);
    for (const piece of game.trayPieces) {
      expect(piece).not.toBeNull();
    }
  });
});

describe('place() — tray refill', () => {
  it('refills the tray after all three slots are placed', () => {
    const game = createGame({ rng: mulberry32(7) });
    const root = document.createElement('div');
    game.mount(root);

    for (let i = 0; i < TRAY_SIZE; i++) {
      const [r, c] = findSafeAnchor(game, i);
      game.place(i, r, c);
    }

    expect(game.trayPieces.length).toBe(TRAY_SIZE);
    const validIds = new Set(CATALOG.map((p) => p.id));
    for (const piece of game.trayPieces) {
      expect(piece).not.toBeNull();
      if (piece) expect(validIds.has(piece.id)).toBe(true);
    }

    const slots = root.querySelectorAll<HTMLElement>('.tray__slot');
    for (let i = 0; i < TRAY_SIZE; i++) {
      expect(slots[i]?.dataset['pieceId']).toBe(game.trayPieces[i]?.id);
    }
  });
});

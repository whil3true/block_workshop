import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDrag, type DragApi } from '../src/drag';
import { createGame, type GameApi } from '../src/game';
import { canPlace, type CellState } from '../src/engine';
import { mulberry32, mountGame } from './helpers';

type Harness = {
  game: GameApi;
  trayEl: HTMLElement;
  boardEl: HTMLElement;
  drag: DragApi;
};

function setup(seed = 1): Harness {
  const { game, trayEl, boardEl } = mountGame(seed, {}, true);
  const drag = createDrag(game, trayEl, boardEl);
  return { game, trayEl, boardEl, drag };
}

function slot(h: Harness, i: number): HTMLElement {
  const el = h.trayEl.querySelector<HTMLElement>(
    `.tray__slot[data-slot-index="${i}"]`,
  );
  if (!el) throw new Error(`slot ${i} not found`);
  return el;
}

function boardCell(h: Harness, r: number, c: number): HTMLElement {
  const el = h.boardEl.querySelector<HTMLElement>(
    `.board__cell[data-row="${r}"][data-col="${c}"]`,
  );
  if (!el) throw new Error(`cell (${r},${c}) not found`);
  return el;
}

function pdown(target: Element, opts: PointerEventInit = {}): void {
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      ...opts,
    }),
  );
}

function pmove(opts: PointerEventInit = {}): void {
  document.dispatchEvent(
    new PointerEvent('pointermove', {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      ...opts,
    }),
  );
}

function pup(opts: PointerEventInit = {}): void {
  document.dispatchEvent(
    new PointerEvent('pointerup', {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      ...opts,
    }),
  );
}

function pcancel(opts: PointerEventInit = {}): void {
  document.dispatchEvent(
    new PointerEvent('pointercancel', {
      pointerId: 1,
      bubbles: true,
      ...opts,
    }),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createDrag — pickup', () => {
  it('creates a ghost and marks the slot when grabbing a filled slot', () => {
    const h = setup();
    pdown(slot(h, 0));
    expect(document.body.querySelector('.ghost')).not.toBeNull();
    expect(slot(h, 0).dataset['picked']).toBe('true');
  });

  it("renders the picked piece's cells inside the ghost", () => {
    const h = setup();
    const piece = h.game.trayPieces[0];
    if (!piece) throw new Error('no piece');
    pdown(slot(h, 0));
    const cells = document.body.querySelectorAll('.ghost .ghost__cell');
    expect(cells.length).toBe(piece.cells.length);
  });

  it('does nothing when the slot is empty', () => {
    const h = setup();
    h.game.place(0, 0, 0);
    pdown(slot(h, 0));
    expect(document.body.querySelector('.ghost')).toBeNull();
    expect(slot(h, 0).dataset['picked']).toBeUndefined();
  });

  it('ignores a second pointerdown while a drag is active', () => {
    const h = setup();
    pdown(slot(h, 0), { pointerId: 1 });
    pdown(slot(h, 1), { pointerId: 2 });
    expect(document.body.querySelectorAll('.ghost').length).toBe(1);
  });
});

describe('createDrag — motion', () => {
  it('follows the pointer via transform translate3d, offset by half a cell', () => {
    const h = setup();
    pdown(slot(h, 0));
    pmove({ clientX: 120, clientY: 80 });
    const ghost = document.body.querySelector<HTMLElement>('.ghost');
    // jsdom returns "" for custom properties; the 64 fallback kicks in, so offset = 32.
    expect(ghost?.style.transform).toContain('translate3d(88px, 48px, 0');
  });

  it('centres the pointer on the top-left bbox cell', () => {
    const h = setup();
    pdown(slot(h, 0));
    pmove({ clientX: 100, clientY: 100 });
    const ghost = document.body.querySelector<HTMLElement>('.ghost');
    expect(ghost?.style.transform).toContain('translate3d(68px, 68px, 0');
  });

  it('uses the un-offset pointer position for hit-testing', () => {
    const h = setup();
    const spy = vi.spyOn(document, 'elementsFromPoint').mockReturnValue([]);
    pdown(slot(h, 0));
    pmove({ clientX: 150, clientY: 120 });
    expect(spy).toHaveBeenCalledWith(150, 120);
  });

  it('ignores pointermove with a different pointerId', () => {
    const h = setup();
    pdown(slot(h, 0), { pointerId: 1 });
    pmove({ pointerId: 99, clientX: 999, clientY: 999 });
    const ghost = document.body.querySelector<HTMLElement>('.ghost');
    expect(ghost?.style.transform ?? '').not.toContain('999');
  });
});

describe('createDrag — legal drop', () => {
  it('calls game.place with the resolved anchor', () => {
    const h = setup();
    const target = boardCell(h, 3, 3);
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([target]);
    const placeSpy = vi.spyOn(h.game, 'place');

    pdown(slot(h, 0));
    pup({ clientX: 200, clientY: 200 });

    expect(placeSpy).toHaveBeenCalledWith(0, 3, 3);
    expect(document.body.querySelector('.ghost')).toBeNull();
    expect(slot(h, 0).dataset['picked']).toBeUndefined();
  });
});

describe('createDrag — illegal drop', () => {
  it('does not place when no board cell is under the pointer', () => {
    const h = setup();
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([]);
    const placeSpy = vi.spyOn(h.game, 'place');

    pdown(slot(h, 0));
    pup();

    expect(placeSpy).not.toHaveBeenCalled();
    expect(document.body.querySelector('.ghost')).toBeNull();
    expect(slot(h, 0).dataset['picked']).toBeUndefined();
  });

  it('does not place when canPlace returns false', () => {
    const h = setup();
    h.game.place(0, 0, 0);
    const piece1 = h.game.trayPieces[1];
    if (!piece1) throw new Error('no piece in slot 1');

    let badR = -1;
    let badC = -1;
    outer: for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (!canPlace(h.game.boardState, piece1, r, c)) {
          badR = r;
          badC = c;
          break outer;
        }
      }
    }
    if (badR < 0) throw new Error('could not find an illegal anchor');

    const target = boardCell(h, badR, badC);
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([target]);
    const placeSpy = vi.spyOn(h.game, 'place');

    pdown(slot(h, 1));
    pup();

    expect(placeSpy).not.toHaveBeenCalled();
    expect(document.body.querySelector('.ghost')).toBeNull();
    expect(slot(h, 1).dataset['picked']).toBeUndefined();
  });
});

describe('createDrag — pointercancel', () => {
  it('cleans up without placing', () => {
    const h = setup();
    const placeSpy = vi.spyOn(h.game, 'place');
    pdown(slot(h, 0));
    pcancel();
    expect(placeSpy).not.toHaveBeenCalled();
    expect(document.body.querySelector('.ghost')).toBeNull();
    expect(slot(h, 0).dataset['picked']).toBeUndefined();
  });
});

describe('createDrag — destroy', () => {
  it('disables subsequent pickups', () => {
    const h = setup();
    h.drag.destroy();
    pdown(slot(h, 0));
    expect(document.body.querySelector('.ghost')).toBeNull();
  });
});

describe('createDrag — audio', () => {
  type AudioCalls = string[];

  function setupWithAudio(): { h: Harness; calls: AudioCalls } {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    document.body.appendChild(root);
    const calls: string[] = [];
    const audio = {
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
    };
    const game = createGame({ rng: mulberry32(1), audio });
    game.mount(root);
    const trayEl = root.querySelector<HTMLElement>('.tray');
    const boardEl = root.querySelector<HTMLElement>('.board');
    if (!trayEl || !boardEl) throw new Error('mount failed');
    const drag = createDrag(game, trayEl, boardEl, audio);
    return { h: { game, trayEl, boardEl, drag }, calls };
  }

  it('calls audio.pickup on a successful pickup', () => {
    const { h, calls } = setupWithAudio();
    pdown(slot(h, 0));
    expect(calls).toContain('pickup');
  });

  it('calls audio.reject on an illegal release', () => {
    const { h, calls } = setupWithAudio();
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([]);
    pdown(slot(h, 0));
    pup();
    expect(calls).toContain('reject');
  });

  it('does not call audio.reject on a legal release', () => {
    const { h, calls } = setupWithAudio();
    const target = boardCell(h, 0, 0);
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([target]);
    pdown(slot(h, 0));
    pup();
    expect(calls).not.toContain('reject');
  });

  it('does not call audio.pickup when game.gameOver is true', () => {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    document.body.appendChild(root);
    const calls: string[] = [];
    const audio = {
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
    };
    const fullBoard: CellState[][] = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => 'sq2') as CellState[],
    );
    const game = createGame({
      rng: mulberry32(1),
      audio,
      initialBoard: fullBoard,
    });
    game.mount(root);
    const trayEl = root.querySelector<HTMLElement>('.tray');
    const boardEl = root.querySelector<HTMLElement>('.board');
    if (!trayEl || !boardEl) throw new Error('mount failed');
    createDrag(game, trayEl, boardEl, audio);
    const slot0 = trayEl.querySelector<HTMLElement>(
      '.tray__slot[data-slot-index="0"]',
    );
    if (!slot0) throw new Error('slot 0 missing');
    pdown(slot0);
    expect(calls).not.toContain('pickup');
  });
});

describe('createDrag — touch finger-lift', () => {
  it('lifts the ghost above the finger for touch pointers', () => {
    const h = setup();
    pdown(slot(h, 0), { pointerType: 'touch' });
    pmove({ pointerType: 'touch', clientX: 120, clientY: 200 });
    const ghost = document.body.querySelector<HTMLElement>('.ghost');
    // jsdom getComputedStyle returns "" → CELL_SIZE_FALLBACK 64 → offset 32.
    // TOUCH_LIFT_PX = 32. x: 120 - 32 = 88. y: 200 - 32 - 32 = 136.
    expect(ghost?.style.transform).toContain('translate3d(88px, 136px, 0');
  });

  it('hit-tests at the lifted position on a touch drop', () => {
    const h = setup();
    const spy = vi.spyOn(document, 'elementsFromPoint').mockReturnValue([]);
    pdown(slot(h, 0), { pointerType: 'touch' });
    pup({ pointerType: 'touch', clientX: 150, clientY: 220 });
    expect(spy).toHaveBeenCalledWith(150, 220 - 32);
  });

  it('does not lift for mouse pointers (iteration-10 behaviour preserved)', () => {
    const h = setup();
    const spy = vi.spyOn(document, 'elementsFromPoint').mockReturnValue([]);
    pdown(slot(h, 0), { pointerType: 'mouse' });
    pup({ pointerType: 'mouse', clientX: 150, clientY: 220 });
    expect(spy).toHaveBeenCalledWith(150, 220);
  });

  it('previews at the lifted target during a touch drag', () => {
    const h = setup();
    const piece = h.game.trayPieces[0];
    if (!piece) throw new Error('no piece');
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([
      boardCell(h, 3, 3),
    ]);
    pdown(slot(h, 0), { pointerType: 'touch' });
    pmove({ pointerType: 'touch', clientX: 100, clientY: 300 });
    for (const [r, c] of piece.cells) {
      expect(boardCell(h, 3 + r, 3 + c).dataset['state']).toBe('preview-ok');
    }
  });
});

describe('createDrag — edge-snap fallback (bottom row reachable)', () => {
  // Synthetic 30px-cell board at (0,0)–(300,300); other elements zero-size.
  function stubBoardGeometry(): void {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement): DOMRect {
        if (this.classList.contains('board__cell')) {
          const r = Number(this.dataset['row']);
          const c = Number(this.dataset['col']);
          const x = c * 30;
          const y = r * 30;
          return {
            x,
            y,
            left: x,
            top: y,
            right: x + 30,
            bottom: y + 30,
            width: 30,
            height: 30,
            toJSON: () => ({}),
          } as DOMRect;
        }
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        } as DOMRect;
      },
    );
  }

  function row9HasPreview(h: Harness): boolean {
    return (
      h.boardEl.querySelectorAll(
        '.board__cell[data-row="9"][data-state="preview-ok"],' +
          '.board__cell[data-row="9"][data-state="preview-bad"]',
      ).length > 0
    );
  }

  it('snaps a point just below the bottom edge to the bottom row', () => {
    const h = setup();
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([]); // force fallback
    stubBoardGeometry();
    pdown(slot(h, 0), { pointerType: 'touch' });
    // lifted y = clientY - 32 = 305 → 5px below the board bottom (300),
    // within one cell-pitch (30) and inside the board horizontally.
    pmove({ pointerType: 'touch', clientX: 150, clientY: 305 + 32 });
    expect(row9HasPreview(h)).toBe(true);
  });

  it('returns null for a point well past the bottom edge (cancel preserved)', () => {
    const h = setup();
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([]);
    stubBoardGeometry();
    pdown(slot(h, 0), { pointerType: 'touch' });
    pmove({ pointerType: 'touch', clientX: 150, clientY: 400 + 32 });
    expect(row9HasPreview(h)).toBe(false);
  });

  it('returns null for a point outside the board horizontally', () => {
    const h = setup();
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([]);
    stubBoardGeometry();
    pdown(slot(h, 0), { pointerType: 'touch' });
    pmove({ pointerType: 'touch', clientX: 350, clientY: 290 + 32 });
    expect(
      h.boardEl.querySelectorAll(
        '.board__cell[data-state="preview-ok"],' +
          '.board__cell[data-state="preview-bad"]',
      ).length,
    ).toBe(0);
  });
});

describe('createDrag — game over gate', () => {
  it('does not start a drag when game.gameOver is true', () => {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    document.body.appendChild(root);
    const fullBoard: CellState[][] = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => 'sq2') as CellState[],
    );
    const game = createGame({
      rng: mulberry32(1),
      initialBoard: fullBoard,
    });
    game.mount(root);
    const trayEl = root.querySelector<HTMLElement>('.tray');
    const boardEl = root.querySelector<HTMLElement>('.board');
    if (!trayEl || !boardEl) throw new Error('mount failed');
    createDrag(game, trayEl, boardEl);

    expect(game.gameOver).toBe(true);
    const slot0 = trayEl.querySelector<HTMLElement>(
      '.tray__slot[data-slot-index="0"]',
    );
    if (!slot0) throw new Error('slot 0 missing');
    pdown(slot0);
    expect(document.body.querySelector('.ghost')).toBeNull();
  });
});

function countCells(h: Harness, state: string): number {
  return h.boardEl.querySelectorAll(`.board__cell[data-state="${state}"]`).length;
}

function findBadAnchor(
  game: GameApi,
  pieceIndex: number,
): { row: number; col: number } {
  const piece = game.trayPieces[pieceIndex];
  if (!piece) throw new Error(`no piece in slot ${pieceIndex}`);
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (!canPlace(game.boardState, piece, r, c)) return { row: r, col: c };
    }
  }
  throw new Error('no illegal anchor found');
}

describe('createDrag — preview', () => {
  it('shows preview-ok on every piece cell at a legal anchor', () => {
    const h = setup();
    const piece = h.game.trayPieces[0];
    if (!piece) throw new Error('no piece');

    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([boardCell(h, 3, 3)]);

    pdown(slot(h, 0));
    pmove({ clientX: 100, clientY: 100 });

    expect(countCells(h, 'preview-ok')).toBe(piece.cells.length);
    expect(countCells(h, 'preview-bad')).toBe(0);
    for (const [r, c] of piece.cells) {
      expect(boardCell(h, 3 + r, 3 + c).dataset['state']).toBe('preview-ok');
    }
  });

  it('shows preview-bad when canPlace returns false', () => {
    const h = setup();
    h.game.place(0, 0, 0);
    const bad = findBadAnchor(h.game, 1);
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([
      boardCell(h, bad.row, bad.col),
    ]);

    pdown(slot(h, 1));
    pmove();

    expect(countCells(h, 'preview-bad')).toBeGreaterThan(0);
    expect(countCells(h, 'preview-ok')).toBe(0);
  });

  it('only previews in-bounds cells near the edge', () => {
    const h = setup();
    const piece = h.game.trayPieces[0];
    if (!piece) throw new Error('no piece');

    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([boardCell(h, 9, 9)]);

    pdown(slot(h, 0));
    pmove();

    const inBoundsCount = piece.cells.filter(
      ([r, c]) => 9 + r < 10 && 9 + c < 10,
    ).length;
    const previewCount =
      countCells(h, 'preview-ok') + countCells(h, 'preview-bad');
    expect(previewCount).toBe(inBoundsCount);
  });

  it('clears preview when the pointer moves off-board', () => {
    const h = setup();
    let nextHit: Element[] = [boardCell(h, 3, 3)];
    vi.spyOn(document, 'elementsFromPoint').mockImplementation(() => nextHit);

    pdown(slot(h, 0));
    pmove();
    expect(
      countCells(h, 'preview-ok') + countCells(h, 'preview-bad'),
    ).toBeGreaterThan(0);

    nextHit = [];
    pmove();
    expect(countCells(h, 'preview-ok')).toBe(0);
    expect(countCells(h, 'preview-bad')).toBe(0);
  });

  it('clears prior preview between successive moves', () => {
    const h = setup();
    const piece = h.game.trayPieces[0];
    if (!piece) throw new Error('no piece');

    let nextHit: Element[] = [boardCell(h, 3, 3)];
    vi.spyOn(document, 'elementsFromPoint').mockImplementation(() => nextHit);

    pdown(slot(h, 0));
    pmove();

    nextHit = [boardCell(h, 5, 5)];
    pmove();

    for (const [r, c] of piece.cells) {
      // Cells from the second move carry preview-ok.
      expect(boardCell(h, 5 + r, 5 + c).dataset['state']).toBe('preview-ok');
      // Cells from the first move are restored to empty (anchors differ, so coords differ).
      expect(boardCell(h, 3 + r, 3 + c).dataset['state']).toBe('empty');
    }
  });

  it('clears preview on a legal drop', () => {
    const h = setup();
    const piece = h.game.trayPieces[0];
    if (!piece) throw new Error('no piece');
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([
      boardCell(h, 0, 0),
    ]);
    pdown(slot(h, 0));
    pmove();
    expect(countCells(h, 'preview-ok')).toBe(piece.cells.length);
    pup();
    expect(countCells(h, 'preview-ok')).toBe(0);
    expect(countCells(h, 'preview-bad')).toBe(0);
  });

  it('clears preview on an illegal drop', () => {
    const h = setup();
    h.game.place(0, 0, 0);
    const bad = findBadAnchor(h.game, 1);
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([
      boardCell(h, bad.row, bad.col),
    ]);
    pdown(slot(h, 1));
    pmove();
    expect(countCells(h, 'preview-bad')).toBeGreaterThan(0);
    pup();
    expect(countCells(h, 'preview-ok')).toBe(0);
    expect(countCells(h, 'preview-bad')).toBe(0);
  });

  it('clears preview on pointercancel', () => {
    const h = setup();
    const piece = h.game.trayPieces[0];
    if (!piece) throw new Error('no piece');
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([
      boardCell(h, 3, 3),
    ]);
    pdown(slot(h, 0));
    pmove();
    expect(countCells(h, 'preview-ok')).toBe(piece.cells.length);
    pcancel();
    expect(countCells(h, 'preview-ok')).toBe(0);
    expect(countCells(h, 'preview-bad')).toBe(0);
  });

  it('clears preview on destroy mid-drag', () => {
    const h = setup();
    const piece = h.game.trayPieces[0];
    if (!piece) throw new Error('no piece');
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([
      boardCell(h, 3, 3),
    ]);
    pdown(slot(h, 0));
    pmove();
    expect(countCells(h, 'preview-ok')).toBe(piece.cells.length);
    h.drag.destroy();
    expect(countCells(h, 'preview-ok')).toBe(0);
    expect(countCells(h, 'preview-bad')).toBe(0);
  });
});

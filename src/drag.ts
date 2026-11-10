import type { GameApi } from './game';
import type { Piece } from './pieces';
import { canPlace, BOARD_SIZE } from './engine';
import { renderBoardState } from './board';
import { createSilentAudio, type AudioApi } from './audio';

export type DragApi = {
  destroy(): void;
  cancel(): void;
};

type ActiveDrag = {
  pointerId: number;
  slotIndex: number;
  slot: HTMLElement;
  ghost: HTMLElement;
  /** Half of `--cell-size` at drag start. The ghost's top-left bbox cell is
   *  centred on the pointer by subtracting this from clientX/clientY. */
  pointerOffset: number;
  /** Vertical lift for touch pointers so the dragged piece floats above the
   *  fingertip; hit-testing uses the lifted point. 0 for mouse / pen. */
  touchLift: number;
};

/** Mirrors the iPad default for `--cell-size` in `src/styles/tokens.css`.
 *  A token-vs-fallback drift test in `tests/tokens.test.ts` keeps these in sync. */
export const CELL_SIZE_FALLBACK = 64;

/** How far above a touch point the dragged piece floats so the fingertip
 *  doesn't occlude the landing target. Behavioural constant, not a CSS token
 *  (it never appears in any stylesheet). Kept small so the bottom row stays
 *  reachable when the board fills the safe height in landscape (iteration 28):
 *  a larger lift pushes the required finger position off the screen bottom. */
const TOUCH_LIFT_PX = 32;

function readCellSize(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--cell-size');
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : CELL_SIZE_FALLBACK;
}

export function createDrag(
  game: GameApi,
  trayEl: HTMLElement,
  boardEl: HTMLElement,
  audio: AudioApi = createSilentAudio(),
  canInteract: () => boolean = () => true,
): DragApi {
  let active: ActiveDrag | null = null;

  function onPointerDown(e: PointerEvent): void {
    if (active || !canInteract()) return;
    if (game.gameOver) return;
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const slot = target.closest<HTMLElement>('.tray__slot');
    if (!slot || !trayEl.contains(slot)) return;
    const slotIndex = Number(slot.dataset['slotIndex']);
    if (!Number.isFinite(slotIndex)) return;
    const piece = game.trayPieces[slotIndex];
    if (!piece) return;

    const pointerOffset = readCellSize() / 2;
    const touchLift = e.pointerType === 'touch' ? TOUCH_LIFT_PX : 0;
    const ghost = createGhost(piece);
    positionGhost(ghost, e.clientX, e.clientY, pointerOffset, touchLift);
    document.body.appendChild(ghost);
    slot.dataset['picked'] = 'true';

    try {
      slot.setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture may not be supported in some test environments.
    }

    active = {
      pointerId: e.pointerId,
      slotIndex,
      slot,
      ghost,
      pointerOffset,
      touchLift,
    };
    audio.pickup();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!active || e.pointerId !== active.pointerId) return;
    if (!canInteract()) { cancel(); return; }
    positionGhost(
      active.ghost,
      e.clientX,
      e.clientY,
      active.pointerOffset,
      active.touchLift,
    );
    updatePreview(e.clientX, e.clientY - active.touchLift);
  }

  function updatePreview(x: number, y: number): void {
    if (!active) return;
    // Re-render canonical engine state so any prior preview is wiped.
    renderBoardState(boardEl, game.boardState);

    const target = findBoardCell(boardEl, x, y);
    if (!target) return;

    const piece = game.trayPieces[active.slotIndex];
    if (!piece) return;

    const ok = canPlace(game.boardState, piece, target.row, target.col);
    const state = ok ? 'preview-ok' : 'preview-bad';

    for (const [r, c] of piece.cells) {
      const row = target.row + r;
      const col = target.col + c;
      if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) continue;
      const cellEl = boardEl.querySelector<HTMLElement>(
        `.board__cell[data-row="${row}"][data-col="${col}"]`,
      );
      if (cellEl) cellEl.dataset['state'] = state;
    }
  }

  function clearPreview(): void {
    renderBoardState(boardEl, game.boardState);
  }

  function finishDrag(release: { x: number; y: number; place: boolean }): void {
    if (!active) return;
    const { slotIndex, slot, ghost, pointerId } = active;

    let placed = false;
    if (release.place && canInteract()) {
      const piece = game.trayPieces[slotIndex];
      if (piece) {
        const cell = findBoardCell(boardEl, release.x, release.y);
        if (cell && canPlace(game.boardState, piece, cell.row, cell.col)) {
          game.place(slotIndex, cell.row, cell.col);
          placed = true; // game.place re-rendered; preview already gone.
        }
      }
    }
    if (!placed) {
      clearPreview();
      audio.reject();
    }

    try { slot.releasePointerCapture(pointerId); } catch { /* already released */ }
    ghost.remove();
    slot.removeAttribute('data-picked');
    active = null;
  }

  function onPointerUp(e: PointerEvent): void {
    if (!active || e.pointerId !== active.pointerId) return;
    finishDrag({
      x: e.clientX,
      y: e.clientY - active.touchLift,
      place: true,
    });
  }

  function onPointerCancel(e: PointerEvent): void {
    if (!active || e.pointerId !== active.pointerId) return;
    finishDrag({ x: 0, y: 0, place: false });
  }

  function cancel(): void {
    if (!active) return;
    const { slot, ghost, pointerId } = active;
    active = null;
    try { slot.releasePointerCapture(pointerId); } catch { /* browser already released */ }
    ghost.remove(); slot.removeAttribute('data-picked'); clearPreview();
  }
  window.addEventListener('resize', cancel);
  window.addEventListener('orientationchange', cancel);
  trayEl.addEventListener('lostpointercapture', cancel);

  trayEl.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerCancel);

  function destroy(): void {
    window.removeEventListener('resize', cancel);
    window.removeEventListener('orientationchange', cancel);
    trayEl.removeEventListener('lostpointercapture', cancel);
    trayEl.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerCancel);
    if (active) {
      active.ghost.remove();
      active.slot.removeAttribute('data-picked');
      clearPreview();
      active = null;
    }
  }

  return { destroy, cancel };
}

function createGhost(piece: Piece): HTMLElement {
  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.style.setProperty('--bbox-w', String(piece.bbox.w));
  ghost.style.setProperty('--bbox-h', String(piece.bbox.h));
  ghost.style.setProperty('--piece-color', `var(--color-piece-${piece.family})`);
  for (const [row, col] of piece.cells) {
    const cell = document.createElement('div');
    cell.className = 'ghost__cell';
    cell.style.gridRow = String(row + 1);
    cell.style.gridColumn = String(col + 1);
    ghost.appendChild(cell);
  }
  return ghost;
}

function positionGhost(
  ghost: HTMLElement,
  x: number,
  y: number,
  offset: number,
  lift: number,
): void {
  ghost.style.transform = `translate3d(${x - offset}px, ${y - offset - lift}px, 0)`;
}

function cellFromPoint(x: number, y: number): { row: number; col: number } | null {
  const elements = document.elementsFromPoint(x, y);
  for (const el of elements) {
    if (el instanceof HTMLElement && el.classList.contains('board__cell')) {
      const row = Number(el.dataset['row']);
      const col = Number(el.dataset['col']);
      if (Number.isFinite(row) && Number.isFinite(col)) {
        return { row, col };
      }
    }
  }
  return null;
}

function cornerCell(boardEl: HTMLElement, row: number, col: number): DOMRect | null {
  const el = boardEl.querySelector<HTMLElement>(
    `.board__cell[data-row="${row}"][data-col="${col}"]`,
  );
  return el ? el.getBoundingClientRect() : null;
}

/**
 * Resolve a screen point to a board cell. Primary: the element directly under
 * the point. Fallback (iteration 28): when nothing is hit but the point is
 * within the board's horizontal span and within one cell-pitch above/below the
 * board, snap to the nearest cell — this keeps the bottom row reachable for
 * flat pieces once the touch-lift is applied. Points further out (e.g. a
 * release over the side-panel tray, or no layout at all in jsdom) return null,
 * so release-to-cancel is preserved.
 */
function findBoardCell(
  boardEl: HTMLElement,
  x: number,
  y: number,
): { row: number; col: number } | null {
  const direct = cellFromPoint(x, y);
  if (direct) return direct;

  const a = cornerCell(boardEl, 0, 0);
  const b = cornerCell(boardEl, BOARD_SIZE - 1, BOARD_SIZE - 1);
  if (!a || !b) return null;
  const { left, top } = a;
  const right = b.right;
  const bottom = b.bottom;
  const spanX = right - left;
  const spanY = bottom - top;
  if (spanX <= 0 || spanY <= 0) return null; // no layout (jsdom) — nothing to snap

  const pitchY = spanY / BOARD_SIZE;
  if (x < left || x > right) return null;
  if (y < top - pitchY || y > bottom + pitchY) return null;

  const clampedY = Math.min(Math.max(y, top), bottom - 0.001);
  const col = Math.min(
    BOARD_SIZE - 1,
    Math.max(0, Math.floor(((x - left) / spanX) * BOARD_SIZE)),
  );
  const row = Math.min(
    BOARD_SIZE - 1,
    Math.max(0, Math.floor(((clampedY - top) / spanY) * BOARD_SIZE)),
  );
  return { row, col };
}

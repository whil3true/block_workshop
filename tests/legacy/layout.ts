export type Orientation = 'portrait' | 'landscape';

export type LayoutInput = {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly insetTop: number;
  readonly insetRight: number;
  readonly insetBottom: number;
  readonly insetLeft: number;
  /** `--screen-pad` token: the shell's preferred edge padding. */
  readonly screenPad: number;
  /** `--board-pad` token: padding inside `.board`, around the 10×10 grid. */
  readonly boardPad: number;
  /** `--cell-gap` token. */
  readonly gap: number;
  /** Minimum legible / touch-comfortable cell size. */
  readonly minCell: number;
  /** HUD width — consulted only in landscape (its side-panel width
   *  contribution). Measured by the binder. */
  readonly hudWidth: number;
  /** HUD height — consulted only in portrait (it stacks above the board).
   *  Measured by the binder. */
  readonly hudHeight: number;
  /** `trayCellSize = floor(cellSize * trayScale)`; 0 < trayScale ≤ 1. */
  readonly trayScale: number;
};

export type Layout = {
  readonly orientation: Orientation;
  readonly cellSize: number;
  readonly boardSize: number;
  readonly trayCellSize: number;
  readonly traySlotSize: number;
  readonly overflow: boolean;
};

const CELLS = 10;

export function computeLayout(input: LayoutInput): Layout {
  const {
    viewportWidth,
    viewportHeight,
    insetTop,
    insetRight,
    insetBottom,
    insetLeft,
    screenPad,
    boardPad,
    gap,
    minCell,
    hudWidth,
    hudHeight,
    trayScale,
  } = input;

  // Fold safe-area insets with the screen-pad token (SPEC §8.9): each edge
  // gets max(token, inset).
  const padL = Math.max(screenPad, insetLeft);
  const padR = Math.max(screenPad, insetRight);
  const padT = Math.max(screenPad, insetTop);
  const padB = Math.max(screenPad, insetBottom);

  const contentW = viewportWidth - padL - padR;
  const contentH = viewportHeight - padT - padB;

  const orientation: Orientation =
    contentW > contentH ? 'landscape' : 'portrait';

  // The board fills the constrained dimension: width in portrait, height in
  // landscape. budget is the square px the board container may occupy.
  const budget = orientation === 'portrait' ? contentW : contentH;

  const rawCell = Math.floor((budget - 2 * boardPad - 9 * gap) / CELLS);
  const clampedUp = rawCell < minCell;
  const cellSize = Math.max(minCell, rawCell);
  const boardSize = 2 * boardPad + CELLS * cellSize + (CELLS - 1) * gap;

  const trayCellSize = Math.max(1, Math.floor(cellSize * trayScale));
  const traySlotSize = 5 * trayCellSize + 4 * gap;

  // The auxiliary (HUD + tray) consumes the *free* dimension; if it doesn't
  // fit, the page scrolls as a last resort — the board never clips (§8.9).
  let auxFits: boolean;
  if (orientation === 'portrait') {
    auxFits = hudHeight + boardSize + traySlotSize <= contentH;
  } else {
    const panelWidth = Math.max(hudWidth, traySlotSize);
    auxFits = boardSize + panelWidth <= contentW;
  }

  return {
    orientation,
    cellSize,
    boardSize,
    trayCellSize,
    traySlotSize,
    overflow: clampedUp || !auxFits,
  };
}

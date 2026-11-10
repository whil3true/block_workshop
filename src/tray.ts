import type { Piece } from './pieces';

export const TRAY_SIZE = 3;

export function createTray(): HTMLElement {
  const tray = document.createElement('div');
  tray.className = 'tray';
  for (let i = 0; i < TRAY_SIZE; i++) {
    const slot = document.createElement('div');
    slot.className = 'tray__slot';
    slot.dataset['slotIndex'] = String(i);
    tray.appendChild(slot);
  }
  return tray;
}

export function renderPieceInSlot(slot: HTMLElement, piece: Piece): void {
  slot.replaceChildren();
  slot.dataset['pieceId'] = piece.id;

  const container = document.createElement('div');
  container.className = 'tray__piece';
  container.style.setProperty('--bbox-w', String(piece.bbox.w));
  container.style.setProperty('--bbox-h', String(piece.bbox.h));
  container.style.setProperty('--piece-color', `var(--color-piece-${piece.family})`);

  for (const [row, col] of piece.cells) {
    const cell = document.createElement('div');
    cell.className = 'tray__piece-cell';
    cell.style.gridRow = String(row + 1);
    cell.style.gridColumn = String(col + 1);
    container.appendChild(cell);
  }

  slot.appendChild(container);
}

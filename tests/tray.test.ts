import { describe, it, expect, beforeEach } from 'vitest';
import { createTray, renderPieceInSlot } from '../src/tray';
import { CATALOG, type Piece } from '../src/pieces';

function pieceById(id: string): Piece {
  const p = CATALOG.find((x) => x.id === id);
  if (!p) throw new Error(`piece "${id}" not found in CATALOG`);
  return p;
}

describe('createTray()', () => {
  it('returns an HTMLElement with class "tray"', () => {
    const tray = createTray();
    expect(tray).toBeInstanceOf(HTMLElement);
    expect(tray.classList.contains('tray')).toBe(true);
  });

  it('contains exactly three slots in order with data-slot-index', () => {
    const tray = createTray();
    const slots = tray.querySelectorAll<HTMLElement>('.tray__slot');
    expect(slots.length).toBe(3);
    expect(slots[0]?.dataset['slotIndex']).toBe('0');
    expect(slots[1]?.dataset['slotIndex']).toBe('1');
    expect(slots[2]?.dataset['slotIndex']).toBe('2');
  });
});

describe('renderPieceInSlot()', () => {
  let slot: HTMLElement;

  beforeEach(() => {
    slot = document.createElement('div');
    slot.className = 'tray__slot';
  });

  it('records the piece id on the slot via data-piece-id', () => {
    renderPieceInSlot(slot, pieceById('single'));
    expect(slot.dataset['pieceId']).toBe('single');
  });

  it('renders exactly piece.cells.length cells for each family', () => {
    const cases: Array<[string, number]> = [
      ['single', 1],
      ['domino-h', 2],
      ['tromino-v', 3],
      ['tetra-h', 4],
      ['penta-v', 5],
      ['square-2', 4],
      ['square-3', 9],
      ['l2-ne', 3],
      ['l3-sw', 5],
    ];
    for (const [id, expected] of cases) {
      const fresh = document.createElement('div');
      fresh.className = 'tray__slot';
      renderPieceInSlot(fresh, pieceById(id));
      const cells = fresh.querySelectorAll('.tray__piece-cell');
      expect(cells.length, `${id} should render ${expected} cells`).toBe(expected);
    }
  });

  it('sets --piece-color on the container based on family', () => {
    renderPieceInSlot(slot, pieceById('square-2'));
    const container = slot.querySelector<HTMLElement>('.tray__piece');
    expect(container?.style.getPropertyValue('--piece-color')).toBe(
      'var(--color-piece-sq2)',
    );
  });

  it('sets --bbox-w and --bbox-h on the container', () => {
    renderPieceInSlot(slot, pieceById('l3-ne'));
    const container = slot.querySelector<HTMLElement>('.tray__piece');
    expect(container?.style.getPropertyValue('--bbox-w')).toBe('3');
    expect(container?.style.getPropertyValue('--bbox-h')).toBe('3');
  });

  it('places cells at 1-indexed CSS-grid coordinates matching the piece', () => {
    renderPieceInSlot(slot, pieceById('l2-ne')); // cells: (0,0), (1,0), (1,1)
    const cells = Array.from(
      slot.querySelectorAll<HTMLElement>('.tray__piece-cell'),
    );
    const coords = cells.map((c) => ({
      row: c.style.gridRow,
      col: c.style.gridColumn,
    }));
    expect(coords).toContainEqual({ row: '1', col: '1' });
    expect(coords).toContainEqual({ row: '2', col: '1' });
    expect(coords).toContainEqual({ row: '2', col: '2' });
  });

  it('replaces a previously rendered piece on re-render', () => {
    renderPieceInSlot(slot, pieceById('square-3'));
    expect(slot.querySelectorAll('.tray__piece-cell').length).toBe(9);

    renderPieceInSlot(slot, pieceById('single'));
    expect(slot.dataset['pieceId']).toBe('single');
    expect(slot.querySelectorAll('.tray__piece-cell').length).toBe(1);
  });
});

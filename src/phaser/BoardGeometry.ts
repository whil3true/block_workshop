import type { PieceFamily } from '../pieces';
export const BOARD = Object.freeze({ x: 20, y: 156, cell: 44, size: 440, gap: 2 });
export const TRAY = Object.freeze({ y: 678, centers: [90, 240, 390] as const, cell: 20, hitWidth: 140, hitHeight: 112 });
export const PIECE_COLORS: Record<PieceFamily, number> = {
 single: 0xa4bcac, line: 0x9cab86, sq2: 0xdeaa8b, sq3: 0xbba9be,
 l2: 0xd1ae72, l3: 0xd4a5a0, 'tetro-t': 0xbba9be, 'tetro-l': 0xdeaa8b,
 'tetro-j': 0xa4bcac, 'tetro-s': 0x9cab86, 'tetro-z': 0xd4a5a0, 'rect-23': 0xd1ae72,
};
/** The pointer targets the first bounding-box cell, as in the DOM game. */
export function boardAnchor(x: number, y: number): { row: number; col: number } | null {
 const col = Math.floor((x - BOARD.x) / BOARD.cell);
 const row = Math.floor((y - BOARD.y) / BOARD.cell);
 return row >= 0 && row < 10 && col >= 0 && col < 10 ? { row, col } : null;
}

export const TILE_MATERIAL: Record<PieceFamily, string> = {
 single: 'eucalyptus', line: 'sage', sq2: 'apricot', sq3: 'lilac', l2: 'honey', l3: 'blush',
 'tetro-t': 'lilac', 'tetro-l': 'apricot', 'tetro-j': 'eucalyptus', 'tetro-s': 'sage', 'tetro-z': 'blush', 'rect-23': 'honey',
};

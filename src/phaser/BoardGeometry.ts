import type { PieceFamily } from '../pieces';
export const BOARD = Object.freeze({ x: 20, y: 156, cell: 44, size: 440, gap: 2 });
export const TRAY = Object.freeze({ y: 678, centers: [90, 240, 390] as const, cell: 20, hitWidth: 140, hitHeight: 112 });
export const PIECE_COLORS: Record<PieceFamily, number> = {
 single: 0x38bdf8, line: 0x4ade80, sq2: 0xf97316, sq3: 0xa78bfa,
 l2: 0xfacc15, l3: 0xf472b6, 'tetro-t': 0x9333ea, 'tetro-l': 0xd97706,
 'tetro-j': 0x2563eb, 'tetro-s': 0x16a34a, 'tetro-z': 0xef4444, 'rect-23': 0x14b8a6,
};
/** The pointer targets the first bounding-box cell, as in the DOM game. */
export function boardAnchor(x: number, y: number): { row: number; col: number } | null {
 const col = Math.floor((x - BOARD.x) / BOARD.cell);
 const row = Math.floor((y - BOARD.y) / BOARD.cell);
 return row >= 0 && row < 10 && col >= 0 && col < 10 ? { row, col } : null;
}

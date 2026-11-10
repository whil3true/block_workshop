export type PieceFamily =
  | 'single'
  | 'line'
  | 'sq2'
  | 'sq3'
  | 'l2'
  | 'l3'
  | 'tetro-t'
  | 'tetro-l'
  | 'tetro-j'
  | 'tetro-s'
  | 'tetro-z'
  | 'rect-23';

export type Piece = {
  readonly id: string;
  readonly family: PieceFamily;
  readonly cells: ReadonlyArray<readonly [number, number]>;
  readonly bbox: { readonly w: number; readonly h: number };
};

function line(id: string, length: number, orientation: 'h' | 'v'): Piece {
  const cells: Array<readonly [number, number]> = [];
  if (orientation === 'h') {
    for (let c = 0; c < length; c++) cells.push([0, c]);
  } else {
    for (let r = 0; r < length; r++) cells.push([r, 0]);
  }
  const bbox =
    orientation === 'h'
      ? ({ w: length, h: 1 } as const)
      : ({ w: 1, h: length } as const);
  return { id, family: 'line', cells, bbox };
}

function square(id: string, side: number, family: PieceFamily): Piece {
  const cells: Array<readonly [number, number]> = [];
  for (let r = 0; r < side; r++) {
    for (let c = 0; c < side; c++) cells.push([r, c]);
  }
  return { id, family, cells, bbox: { w: side, h: side } };
}

export const CATALOG: ReadonlyArray<Piece> = [
  { id: 'single', family: 'single', cells: [[0, 0]], bbox: { w: 1, h: 1 } },

  line('domino-h', 2, 'h'),
  line('domino-v', 2, 'v'),
  line('tromino-h', 3, 'h'),
  line('tromino-v', 3, 'v'),
  line('tetra-h', 4, 'h'),
  line('tetra-v', 4, 'v'),
  line('penta-h', 5, 'h'),
  line('penta-v', 5, 'v'),

  square('square-2', 2, 'sq2'),
  square('square-3', 3, 'sq3'),

  // L2 — suffix names the corner the L opens toward (missing bbox corner)
  { id: 'l2-ne', family: 'l2', cells: [[0, 0], [1, 0], [1, 1]], bbox: { w: 2, h: 2 } },
  { id: 'l2-se', family: 'l2', cells: [[0, 0], [0, 1], [1, 0]], bbox: { w: 2, h: 2 } },
  { id: 'l2-sw', family: 'l2', cells: [[0, 0], [0, 1], [1, 1]], bbox: { w: 2, h: 2 } },
  { id: 'l2-nw', family: 'l2', cells: [[0, 1], [1, 0], [1, 1]], bbox: { w: 2, h: 2 } },

  // L3 — suffix names the corner the L opens toward
  { id: 'l3-ne', family: 'l3', cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], bbox: { w: 3, h: 3 } },
  { id: 'l3-se', family: 'l3', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], bbox: { w: 3, h: 3 } },
  { id: 'l3-sw', family: 'l3', cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], bbox: { w: 3, h: 3 } },
  { id: 'l3-nw', family: 'l3', cells: [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]], bbox: { w: 3, h: 3 } },

  // T-tetromino — suffix names the direction the stem points.
  { id: 'tetro-t-up',    family: 'tetro-t', cells: [[0, 1], [1, 0], [1, 1], [1, 2]], bbox: { w: 3, h: 2 } },
  { id: 'tetro-t-right', family: 'tetro-t', cells: [[0, 0], [1, 0], [2, 0], [1, 1]], bbox: { w: 2, h: 3 } },
  { id: 'tetro-t-down',  family: 'tetro-t', cells: [[0, 0], [0, 1], [0, 2], [1, 1]], bbox: { w: 3, h: 2 } },
  { id: 'tetro-t-left',  family: 'tetro-t', cells: [[0, 1], [1, 1], [2, 1], [1, 0]], bbox: { w: 2, h: 3 } },

  // L-tetromino — the shape drawn top-left; suffix is the clockwise angle.
  { id: 'tetro-l-0',   family: 'tetro-l', cells: [[0, 0], [1, 0], [2, 0], [2, 1]], bbox: { w: 2, h: 3 } },
  { id: 'tetro-l-90',  family: 'tetro-l', cells: [[0, 0], [0, 1], [0, 2], [1, 0]], bbox: { w: 3, h: 2 } },
  { id: 'tetro-l-180', family: 'tetro-l', cells: [[0, 0], [0, 1], [1, 1], [2, 1]], bbox: { w: 2, h: 3 } },
  { id: 'tetro-l-270', family: 'tetro-l', cells: [[0, 2], [1, 0], [1, 1], [1, 2]], bbox: { w: 3, h: 2 } },

  // J-tetromino — mirror image of L (a reflection, not a rotation).
  { id: 'tetro-j-0',   family: 'tetro-j', cells: [[0, 1], [1, 1], [2, 1], [2, 0]], bbox: { w: 2, h: 3 } },
  { id: 'tetro-j-90',  family: 'tetro-j', cells: [[0, 0], [1, 0], [1, 1], [1, 2]], bbox: { w: 3, h: 2 } },
  { id: 'tetro-j-180', family: 'tetro-j', cells: [[0, 0], [0, 1], [1, 0], [2, 0]], bbox: { w: 2, h: 3 } },
  { id: 'tetro-j-270', family: 'tetro-j', cells: [[0, 0], [0, 1], [0, 2], [1, 2]], bbox: { w: 3, h: 2 } },

  // S-tetromino — two distinct rotations.
  { id: 'tetro-s-0',  family: 'tetro-s', cells: [[0, 1], [0, 2], [1, 0], [1, 1]], bbox: { w: 3, h: 2 } },
  { id: 'tetro-s-90', family: 'tetro-s', cells: [[0, 0], [1, 0], [1, 1], [2, 1]], bbox: { w: 2, h: 3 } },

  // Z-tetromino — mirror image of S.
  { id: 'tetro-z-0',  family: 'tetro-z', cells: [[0, 0], [0, 1], [1, 1], [1, 2]], bbox: { w: 3, h: 2 } },
  { id: 'tetro-z-90', family: 'tetro-z', cells: [[0, 1], [1, 0], [1, 1], [2, 0]], bbox: { w: 2, h: 3 } },

  // 2×3 rectangle (Block Blast) — two orientations.
  { id: 'rect-23-h', family: 'rect-23', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], bbox: { w: 3, h: 2 } },
  { id: 'rect-23-v', family: 'rect-23', cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]], bbox: { w: 2, h: 3 } },
];

/** Every family present in the catalogue — the single source of truth.
 *  Consumers (e.g. snapshot validation) must derive from this, not duplicate it. */
export const PIECE_FAMILIES: ReadonlyArray<PieceFamily> = Array.from(
  new Set(CATALOG.map((p) => p.family)),
);

/**
 * Relative likelihood of drawing each family. Iteration 32 — replaces the
 * uniform-over-37 bag, which made the game feel too hard because
 * rotation-heavy and bulky families crowded out the small flexible ones.
 * Tune in playtest; these are starting values.
 */
export const FAMILY_WEIGHTS: Readonly<Record<PieceFamily, number>> = {
  'single':   5,
  'line':     12,
  'sq2':      6,
  'sq3':      1,
  'l2':       5,
  'l3':       1,
  'tetro-t':  3,
  'tetro-l':  3,
  'tetro-j':  3,
  'tetro-s':  2,
  'tetro-z':  2,
  'rect-23':  2,
};

/** Small, near-always-placeable families used by the anti-frustration
 *  guarantee in `sampleTray`. `line` is intentionally excluded — a 5-long
 *  line on a partial board is not "easy". */
export const EASY_FAMILIES: ReadonlySet<PieceFamily> = new Set<PieceFamily>([
  'single',
  'sq2',
  'l2',
]);

const PIECES_BY_FAMILY: ReadonlyMap<PieceFamily, ReadonlyArray<Piece>> =
  (() => {
    const m = new Map<PieceFamily, Piece[]>();
    for (const p of CATALOG) {
      const arr = m.get(p.family) ?? [];
      arr.push(p);
      m.set(p.family, arr);
    }
    return m;
  })();

const WEIGHTED_FAMILIES: ReadonlyArray<{
  readonly family: PieceFamily;
  readonly cumulative: number;
}> = (() => {
  let acc = 0;
  return PIECE_FAMILIES.map((family) => {
    acc += FAMILY_WEIGHTS[family];
    return { family, cumulative: acc };
  });
})();

const TOTAL_WEIGHT: number =
  WEIGHTED_FAMILIES[WEIGHTED_FAMILIES.length - 1]?.cumulative ?? 0;

const EASY_POOL: ReadonlyArray<Piece> = CATALOG.filter((p) =>
  EASY_FAMILIES.has(p.family),
);

/**
 * Weighted sampler — picks a family by `FAMILY_WEIGHTS`, then a rotation
 * uniformly within that family. Rotation-heavy families therefore don't
 * dominate just by having more catalogue entries.
 */
export function samplePieceWeighted(rng: () => number): Piece {
  const r = rng() * TOTAL_WEIGHT;
  let family: PieceFamily = WEIGHTED_FAMILIES[0]!.family;
  for (const bucket of WEIGHTED_FAMILIES) {
    if (r < bucket.cumulative) {
      family = bucket.family;
      break;
    }
  }
  const pool = PIECES_BY_FAMILY.get(family) ?? CATALOG;
  const idx = Math.floor(rng() * pool.length);
  return pool[idx] ?? CATALOG[0]!;
}

/**
 * Deal a tray of `size` pieces using `samplePieceWeighted`, with the
 * anti-frustration guarantee that at least one piece is from an
 * `EASY_FAMILIES` member. If no draw was easy, slot 0 is replaced with a
 * uniform pick from the easy pool.
 */
export function sampleTray(rng: () => number, size: number): Piece[] {
  const tray: Piece[] = [];
  for (let i = 0; i < size; i++) tray.push(samplePieceWeighted(rng));
  if (!tray.some((p) => EASY_FAMILIES.has(p.family))) {
    const idx = Math.floor(rng() * EASY_POOL.length);
    tray[0] = EASY_POOL[idx] ?? tray[0]!;
  }
  return tray;
}

export function samplePiece(rng: () => number): Piece {
  const index = Math.floor(rng() * CATALOG.length);
  const piece = CATALOG[index];
  if (!piece) {
    throw new Error(`samplePiece: rng produced out-of-range index ${index}`);
  }
  return piece;
}

export function findPieceById(id: string): Piece | undefined {
  return CATALOG.find((p) => p.id === id);
}

import { describe, it, expect } from 'vitest';
import {
  CATALOG,
  EASY_FAMILIES,
  FAMILY_WEIGHTS,
  PIECE_FAMILIES,
  samplePiece,
  samplePieceWeighted,
  sampleTray,
} from '../src/pieces';
import { mulberry32 } from './helpers';

describe('samplePiece(rng)', () => {
  it('returns a piece that is referentially in CATALOG', () => {
    const piece = samplePiece(() => 0);
    expect(CATALOG).toContain(piece);
  });

  it('is deterministic for a given RNG sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 50 }, () => samplePiece(a));
    const seqB = Array.from({ length: 50 }, () => samplePiece(b));
    expect(seqA.map((p) => p.id)).toEqual(seqB.map((p) => p.id));
  });

  it('picks index Math.floor(r * CATALOG.length) for r in [0, 1)', () => {
    for (let i = 0; i < CATALOG.length; i++) {
      const r = i / CATALOG.length;
      const piece = samplePiece(() => r);
      expect(piece).toBe(CATALOG[i]);
    }
  });

  it('can reach every piece across many samples', () => {
    const rng = mulberry32(1);
    const seen = new Set<string>();
    for (let i = 0; i < 2000 && seen.size < CATALOG.length; i++) {
      seen.add(samplePiece(rng).id);
    }
    expect(seen.size).toBe(CATALOG.length);
  });

  it('does not mutate CATALOG', () => {
    const beforeIds = CATALOG.map((p) => p.id);
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) samplePiece(rng);
    expect(CATALOG.map((p) => p.id)).toEqual(beforeIds);
    expect(CATALOG.length).toBe(beforeIds.length);
  });
});

describe('samplePieceWeighted(rng)', () => {
  it('is deterministic for a given rng sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 50 }, () => samplePieceWeighted(a).id);
    const seqB = Array.from({ length: 50 }, () => samplePieceWeighted(b).id);
    expect(seqA).toEqual(seqB);
  });

  it('only returns pieces in CATALOG', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 500; i++) {
      expect(CATALOG).toContain(samplePieceWeighted(rng));
    }
  });

  it('empirical family distribution matches FAMILY_WEIGHTS within tolerance', () => {
    const totalWeight = Object.values(FAMILY_WEIGHTS).reduce((a, b) => a + b, 0);
    const N = 5000;
    const rng = mulberry32(7);
    const counts: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const fam = samplePieceWeighted(rng).family;
      counts[fam] = (counts[fam] ?? 0) + 1;
    }
    for (const fam of PIECE_FAMILIES) {
      const observed = (counts[fam] ?? 0) / N;
      const expected = FAMILY_WEIGHTS[fam] / totalWeight;
      // 4 percentage points absolute — generous to avoid flakes; still
      // tight enough to catch a broken weighting.
      expect(Math.abs(observed - expected)).toBeLessThan(0.04);
    }
  });

  it('rotations within a family are roughly uniform', () => {
    // T-tetromino has 4 rotations; over enough samples each should appear.
    const rng = mulberry32(11);
    const seen = new Set<string>();
    for (let i = 0; i < 5000 && seen.size < 4; i++) {
      const p = samplePieceWeighted(rng);
      if (p.family === 'tetro-t') seen.add(p.id);
    }
    expect(seen.size).toBe(4);
  });
});

describe('sampleTray(rng, size)', () => {
  it('returns exactly `size` pieces drawn from CATALOG, deterministically', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const trayA = sampleTray(a, 3);
    const trayB = sampleTray(b, 3);
    expect(trayA.length).toBe(3);
    expect(trayA.map((p) => p.id)).toEqual(trayB.map((p) => p.id));
    for (const p of trayA) expect(CATALOG).toContain(p);
  });

  it('every tray contains at least one piece from an EASY family', () => {
    // Across many seeds — covers both the "naturally has easy" path and
    // the "no easy → replace slot 0" path.
    for (let seed = 1; seed <= 300; seed++) {
      const tray = sampleTray(mulberry32(seed), 3);
      const hasEasy = tray.some((p) => EASY_FAMILIES.has(p.family));
      expect(hasEasy, `tray for seed ${seed} has no easy piece`).toBe(true);
    }
  });
});

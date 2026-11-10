import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createGame, type GameApi, type GameOptions } from '../src/game';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Deterministic PRNG used by every seed-driven test. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** A piece's cells as a `"r,c"` Set, for order-independent comparison. */
export function cellsAsSet(
  cells: ReadonlyArray<readonly [number, number]>,
): Set<string> {
  return new Set(cells.map(([r, c]) => `${r},${c}`));
}

/** Read a source file relative to the repo root (e.g. `src/styles/board.css`). */
export function readSrc(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), 'utf-8');
}

/** Read a stylesheet from `src/styles/` by file name. */
export function readCss(name: string): string {
  return readSrc(`src/styles/${name}`);
}

export type GameHarness = {
  game: GameApi;
  root: HTMLElement;
  trayEl: HTMLElement;
  boardEl: HTMLElement;
};

/**
 * Create a game seeded deterministically and mount it into a fresh root.
 * `attach` adds the root to `document.body` (needed when document-level
 * listeners / `elementsFromPoint` are involved, e.g. drag tests).
 */
export function mountGame(
  seed = 1,
  options: Omit<GameOptions, 'rng'> = {},
  attach = false,
): GameHarness {
  const game = createGame({ rng: mulberry32(seed), ...options });
  const root = document.createElement('div');
  if (attach) {
    document.body.innerHTML = '';
    document.body.appendChild(root);
  }
  game.mount(root);
  const trayEl = root.querySelector<HTMLElement>('.tray');
  const boardEl = root.querySelector<HTMLElement>('.board');
  if (!trayEl || !boardEl) throw new Error('mountGame: mount failed');
  return { game, root, trayEl, boardEl };
}

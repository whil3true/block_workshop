import { describe, it, expect, beforeAll } from 'vitest';
import { CELL_SIZE_FALLBACK } from '../src/drag';
import { readCss } from './helpers';

let tokens = '';
beforeAll(() => {
  tokens = readCss('tokens.css');
});

const numToken = (name: string): number => {
  const m = tokens.match(new RegExp(`${name}\\s*:\\s*(\\d+)`, 'i'));
  if (!m) throw new Error(`token ${name} not declared`);
  return Number(m[1]);
};

describe('tokens.css', () => {
  it('declares the Modern Dark surface colours', () => {
    for (const [name, hex] of [
      ['--color-bg', '#0F172A'],
      ['--color-board', '#1E293B'],
      ['--color-cell-empty', '#334155'],
      ['--color-text', '#F1F5F9'],
    ] as const) {
      expect(tokens).toMatch(new RegExp(`${name}\\s*:\\s*${hex}`, 'i'));
    }
  });

  it('declares one colour per piece family (all 12)', () => {
    for (const [name, hex] of [
      ['--color-piece-single', '#38BDF8'],
      ['--color-piece-line', '#4ADE80'],
      ['--color-piece-sq2', '#F97316'],
      ['--color-piece-sq3', '#A78BFA'],
      ['--color-piece-l2', '#FACC15'],
      ['--color-piece-l3', '#F472B6'],
      ['--color-piece-tetro-t', '#9333EA'],
      ['--color-piece-tetro-l', '#D97706'],
      ['--color-piece-tetro-j', '#2563EB'],
      ['--color-piece-tetro-s', '#16A34A'],
      ['--color-piece-tetro-z', '#EF4444'],
      ['--color-piece-rect-23', '#14B8A6'],
    ] as const) {
      expect(tokens).toMatch(new RegExp(`${name}\\s*:\\s*${hex}`, 'i'));
    }
  });

  it('declares the required layout / z-index tokens', () => {
    for (const name of [
      '--cell-size', '--cell-gap', '--tray-cell-size', '--radius',
      '--board-size', '--z-ghost', '--ghost-opacity', '--z-overlay',
    ]) {
      expect(tokens).toMatch(new RegExp(`${name}\\s*:`));
    }
  });

  it('holds the sizing & stacking invariants', () => {
    // Tray cells are smaller than board cells.
    expect(numToken('--tray-cell-size')).toBeLessThan(numToken('--cell-size'));
    // z order: version badge > start gate > ghost.
    expect(numToken('--z-version')).toBeGreaterThan(numToken('--z-start-gate'));
    expect(numToken('--z-start-gate')).toBeGreaterThan(numToken('--z-ghost'));
  });

  it('is JS-derived with no width breakpoint (SPEC §8.3 / §8.9)', () => {
    expect(tokens).not.toMatch(/@media\s*\(\s*max-width/i);
    expect(tokens).toMatch(/--min-cell\s*:\s*28px/i);
    expect(tokens).toMatch(/--tray-scale\s*:\s*0?\.5\b/i);
    expect(tokens).toMatch(/--cell-gap\s*:\s*2px/i);
    expect(tokens).toMatch(/--board-pad\s*:\s*6px/i);
    expect(tokens).toMatch(/--screen-pad\s*:\s*12px/i);
    expect(tokens).toMatch(/--board-size\s*:/);
  });

  it('keeps CELL_SIZE_FALLBACK in drag.ts in sync with the --cell-size fallback', () => {
    expect(numToken('--cell-size')).toBe(CELL_SIZE_FALLBACK);
  });
});

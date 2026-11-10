import { describe, it, expect, vi } from 'vitest';
import {
  createViewportBinder,
  createDomMeasure,
} from '../src/viewport';
import { computeLayout, type LayoutInput } from '../src/layout';

const TOKENS = { screenPad: 12, boardPad: 6, gap: 2, minCell: 28, trayScale: 0.5 };

function metrics(p: Partial<LayoutInput> & {
  viewportWidth: number;
  viewportHeight: number;
}): LayoutInput {
  return {
    insetTop: 0,
    insetRight: 0,
    insetBottom: 0,
    insetLeft: 0,
    hudWidth: 60,
    hudHeight: 60,
    ...TOKENS,
    ...p,
  };
}

function harness() {
  const appEl = document.createElement('div');
  const root = document.createElement('div');
  return { appEl, root };
}

describe('createViewportBinder — applies computeLayout to the DOM', () => {
  it('writes the four size vars + orientation/overflow on construction (portrait)', () => {
    const { appEl, root } = harness();
    const m = metrics({ viewportWidth: 393, viewportHeight: 852, insetTop: 59 });
    const expected = computeLayout(m);

    createViewportBinder({
      appEl,
      root,
      measure: () => m,
      subscribe: () => () => {},
    });

    expect(root.style.getPropertyValue('--cell-size')).toBe(`${expected.cellSize}px`);
    expect(root.style.getPropertyValue('--board-size')).toBe(`${expected.boardSize}px`);
    expect(root.style.getPropertyValue('--tray-cell-size')).toBe(
      `${expected.trayCellSize}px`,
    );
    expect(root.style.getPropertyValue('--tray-slot-size')).toBe(
      `${expected.traySlotSize}px`,
    );
    expect(appEl.dataset['orientation']).toBe('portrait');
    expect(appEl.dataset['overflow']).toBe(String(expected.overflow));
  });

  it('reports landscape orientation for a wide safe box', () => {
    const { appEl, root } = harness();
    const m = metrics({
      viewportWidth: 852,
      viewportHeight: 393,
      insetLeft: 59,
      insetRight: 59,
    });
    createViewportBinder({
      appEl,
      root,
      measure: () => m,
      subscribe: () => () => {},
    });
    expect(appEl.dataset['orientation']).toBe('landscape');
    expect(root.style.getPropertyValue('--board-size')).toBe(
      `${computeLayout(m).boardSize}px`,
    );
  });

  it('re-applies when the subscribed change source fires', () => {
    const { appEl, root } = harness();
    let cur = metrics({ viewportWidth: 393, viewportHeight: 852 });
    let fire: () => void = () => {};

    createViewportBinder({
      appEl,
      root,
      measure: () => cur,
      subscribe: (onChange) => {
        fire = onChange;
        return () => {};
      },
    });
    expect(appEl.dataset['orientation']).toBe('portrait');

    cur = metrics({ viewportWidth: 852, viewportHeight: 393 });
    fire();
    expect(appEl.dataset['orientation']).toBe('landscape');
    expect(root.style.getPropertyValue('--board-size')).toBe(
      `${computeLayout(cur).boardSize}px`,
    );
  });

  it('destroy() unsubscribes the change source', () => {
    const { appEl, root } = harness();
    const unsubscribe = vi.fn();
    const binder = createViewportBinder({
      appEl,
      root,
      measure: () => metrics({ viewportWidth: 400, viewportHeight: 800 }),
      subscribe: () => unsubscribe,
    });
    expect(unsubscribe).not.toHaveBeenCalled();
    binder.destroy();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('apply() returns the Layout', () => {
    const { appEl, root } = harness();
    const m = metrics({ viewportWidth: 1024, viewportHeight: 768 });
    const binder = createViewportBinder({
      appEl,
      root,
      measure: () => m,
      subscribe: () => () => {},
    });
    expect(binder.apply()).toEqual(computeLayout(m));
  });
});

describe('createDomMeasure — real measurement path', () => {
  it('produces a finite LayoutInput in jsdom and never throws', () => {
    const appEl = document.createElement('div');
    const hudEl = document.createElement('div');
    const root = document.documentElement;
    document.body.appendChild(appEl);

    const measure = createDomMeasure({ appEl, hudEl, root });
    let input!: LayoutInput;
    expect(() => {
      input = measure();
    }).not.toThrow();

    for (const v of Object.values(input)) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(() => computeLayout(input)).not.toThrow();
  });
});

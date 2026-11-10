import { computeLayout, type Layout, type LayoutInput } from './layout';

export type ViewportBinderOptions = {
  /** Element that receives `data-orientation` / `data-overflow`. */
  readonly appEl: HTMLElement;
  /** Element whose inline style receives the derived size custom properties
   *  (`document.documentElement` in production). */
  readonly root: HTMLElement;
  /** Produces the current `LayoutInput`. Injected in tests; built by
   *  `createDomMeasure` in production. */
  readonly measure: () => LayoutInput;
  /** Registers a re-layout trigger; returns an unsubscribe. Defaults to a
   *  rAF-coalesced `resize` + `orientationchange` listener pair. */
  readonly layout?: (input: LayoutInput) => Layout;
  readonly subscribe?: (onChange: () => void) => () => void;
};

export type ViewportBinder = {
  /** Recompute and write the layout now; returns what was applied. */
  readonly apply: () => Layout;
  /** Remove listeners. */
  readonly destroy: () => void;
};

function defaultSubscribe(onChange: () => void): () => void {
  const raf =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb: FrameRequestCallback): number =>
          setTimeout(() => cb(0), 16) as unknown as number;
  const caf =
    typeof cancelAnimationFrame === 'function'
      ? cancelAnimationFrame
      : (clearTimeout as unknown as (h: number) => void);

  let pending = 0;
  const handler = (): void => {
    if (pending) return;
    pending = raf(() => {
      pending = 0;
      onChange();
    });
  };
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', handler);
  return () => {
    window.removeEventListener('resize', handler);
    window.removeEventListener('orientationchange', handler);
    if (pending) caf(pending);
  };
}

export function createViewportBinder(
  opts: ViewportBinderOptions,
): ViewportBinder {
  const { appEl, root, measure } = opts;
  const subscribe = opts.subscribe ?? defaultSubscribe;

  const apply = (): Layout => {
    const layout = (opts.layout ?? computeLayout)(measure());
    root.style.setProperty('--cell-size', `${layout.cellSize}px`);
    root.style.setProperty('--board-size', `${layout.boardSize}px`);
    root.style.setProperty('--tray-cell-size', `${layout.trayCellSize}px`);
    root.style.setProperty('--tray-slot-size', `${layout.traySlotSize}px`);
    appEl.dataset['orientation'] = layout.orientation;
    appEl.dataset['overflow'] = String(layout.overflow);
    return layout;
  };

  apply();
  const unsubscribe = subscribe(apply);

  return {
    apply,
    destroy: () => unsubscribe(),
  };
}

export type DomMeasureOptions = {
  readonly appEl: HTMLElement;
  readonly hudEl: HTMLElement;
  readonly root: HTMLElement;
};

function num(value: string | number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Builds the production `measure` closure. `env(safe-area-inset-*)` cannot be
 * read directly in JS, so a hidden fixed probe carries it as padding and we
 * read the resolved pixels back. Tokens come from `:root`'s computed style;
 * the HUD's box is measured live. Token fallbacks mirror `tokens.css` so the
 * first measurement is sane even before stylesheets resolve.
 */
export function createDomMeasure(
  opts: DomMeasureOptions,
): () => LayoutInput {
  const { appEl, hudEl, root } = opts;

  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.position = 'fixed';
  probe.style.top = '0';
  probe.style.left = '0';
  probe.style.width = '0';
  probe.style.height = '0';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.paddingTop = 'env(safe-area-inset-top)';
  probe.style.paddingRight = 'env(safe-area-inset-right)';
  probe.style.paddingBottom = 'env(safe-area-inset-bottom)';
  probe.style.paddingLeft = 'env(safe-area-inset-left)';
  document.body.appendChild(probe);

  return (): LayoutInput => {
    const probeCS = getComputedStyle(probe);
    const rootCS = getComputedStyle(root);
    const token = (name: string, fallback: number): number =>
      num(rootCS.getPropertyValue(name).trim(), fallback);
    const hud = hudEl.getBoundingClientRect();
    void appEl;

    return {
      viewportWidth: num(window.innerWidth, 0),
      viewportHeight: num(window.innerHeight, 0),
      insetTop: num(probeCS.paddingTop, 0),
      insetRight: num(probeCS.paddingRight, 0),
      insetBottom: num(probeCS.paddingBottom, 0),
      insetLeft: num(probeCS.paddingLeft, 0),
      screenPad: token('--screen-pad', 12),
      boardPad: token('--board-pad', 6),
      gap: token('--cell-gap', 2),
      minCell: token('--min-cell', 28),
      trayScale: token('--tray-scale', 0.5),
      hudWidth: num(hud.width, 0),
      hudHeight: num(hud.height, 0),
    };
  };
}

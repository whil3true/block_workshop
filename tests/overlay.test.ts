import { describe, it, expect, beforeAll } from 'vitest';
import { createOverlay, renderOverlay } from '../src/overlay';
import { readCss } from './helpers';

describe('createOverlay()', () => {
  it('returns an HTMLElement with class "overlay" and data-visible="false"', () => {
    const el = createOverlay();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains('overlay')).toBe(true);
    expect(el.dataset['visible']).toBe('false');
  });

  it('contains heading "GAME OVER", score "0", and button "New game"', () => {
    const el = createOverlay();
    expect(el.querySelector('.overlay__heading')?.textContent).toBe('GAME OVER');
    expect(el.querySelector('.overlay__score')?.textContent).toBe('0');
    expect(el.querySelector('.overlay__button')?.textContent).toBe('New game');
  });
});

describe('renderOverlay()', () => {
  it('toggles data-visible and updates the score', () => {
    const el = createOverlay();
    renderOverlay(el, { visible: true, score: 540 });
    expect(el.dataset['visible']).toBe('true');
    expect(el.querySelector('.overlay__score')?.textContent).toBe('540');
  });

  it('hides again on visible=false', () => {
    const el = createOverlay();
    renderOverlay(el, { visible: true, score: 100 });
    renderOverlay(el, { visible: false, score: 100 });
    expect(el.dataset['visible']).toBe('false');
  });

  it('keeps heading and button intact across renders', () => {
    const el = createOverlay();
    renderOverlay(el, { visible: true, score: 42 });
    renderOverlay(el, { visible: false, score: 999 });
    expect(el.querySelector('.overlay__heading')?.textContent).toBe('GAME OVER');
    expect(el.querySelector('.overlay__button')?.textContent).toBe('New game');
  });
});

describe('overlay.css — fade-in', () => {
  let css = '';

  beforeAll(() => {
    css = readCss('overlay.css');
  });

  it('transitions opacity on the .overlay element', () => {
    expect(css).toMatch(/\.overlay\s*\{[^}]*transition:[^;]*opacity/);
  });
});

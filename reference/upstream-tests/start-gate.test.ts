import { describe, it, expect, vi } from 'vitest';
import { createStartGate } from '../src/start-gate';

describe('createStartGate()', () => {
  it('returns a visible .start-gate with a "Tap to play" button', () => {
    const gate = createStartGate(() => {});
    expect(gate).toBeInstanceOf(HTMLElement);
    expect(gate.classList.contains('start-gate')).toBe(true);
    expect(gate.dataset['visible']).toBe('true');

    const btn = gate.querySelector<HTMLButtonElement>('.start-gate__button');
    expect(btn).not.toBeNull();
    expect(btn?.tagName).toBe('BUTTON');
    expect(btn?.textContent).toBe('Tap to play');
    expect(btn?.getAttribute('aria-label')).toBeTruthy();
  });

  it('calls onStart once and hides the gate on click', () => {
    const onStart = vi.fn();
    const gate = createStartGate(onStart);
    const btn = gate.querySelector<HTMLButtonElement>('.start-gate__button');
    btn?.click();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(gate.dataset['visible']).toBe('false');
  });

  it('does not call onStart again on a second click', () => {
    const onStart = vi.fn();
    const gate = createStartGate(onStart);
    const btn = gate.querySelector<HTMLButtonElement>('.start-gate__button');
    btn?.click();
    btn?.click();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('exposes a "Rules" link opening /rules.html in a new tab', () => {
    const gate = createStartGate(() => {});
    const link = gate.querySelector<HTMLAnchorElement>('.start-gate__rules');
    expect(link).not.toBeNull();
    expect(link?.tagName).toBe('A');
    expect(link?.textContent).toBe('Rules');
    expect(link?.getAttribute('href')).toBe('/rules.html');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel') ?? '').toContain('noopener');
  });

  it('groups button + link in a single centred inner container', () => {
    // Regression: appending both directly to the grid created two auto rows
    // that align-content stretched apart (button up, link down). They must
    // live in one .start-gate__inner so the gate centres them as a group.
    const gate = createStartGate(() => {});
    expect(gate.children.length).toBe(1);
    const inner = gate.firstElementChild as HTMLElement;
    expect(inner.classList.contains('start-gate__inner')).toBe(true);
    expect(inner.querySelector('.start-gate__button')).not.toBeNull();
    expect(inner.querySelector('.start-gate__rules')).not.toBeNull();
  });

  it('clicking the Rules link neither starts nor hides the gate', () => {
    const onStart = vi.fn();
    const gate = createStartGate(onStart);
    const link = gate.querySelector<HTMLAnchorElement>('.start-gate__rules');
    link?.click();
    expect(onStart).not.toHaveBeenCalled();
    expect(gate.dataset['visible']).toBe('true');
  });
});

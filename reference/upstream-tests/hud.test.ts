import { describe, it, expect } from 'vitest';
import { createHud, renderScore, renderBestScore, renderMute } from '../src/hud';

describe('createHud()', () => {
  it('returns an HTMLElement with class "hud"', () => {
    const hud = createHud();
    expect(hud).toBeInstanceOf(HTMLElement);
    expect(hud.classList.contains('hud')).toBe(true);
  });

  it('contains a label reading "SCORE"', () => {
    const hud = createHud();
    expect(hud.querySelector('.hud__label')?.textContent).toBe('SCORE');
  });

  it('initialises the score to "0"', () => {
    const hud = createHud();
    expect(hud.querySelector('.hud__score')?.textContent).toBe('0');
  });
});

describe('renderScore()', () => {
  it('updates the score text', () => {
    const hud = createHud();
    renderScore(hud, 1240);
    expect(hud.querySelector('.hud__score')?.textContent).toBe('1240');
  });

  it('overwrites on repeated calls', () => {
    const hud = createHud();
    renderScore(hud, 100);
    renderScore(hud, 50);
    expect(hud.querySelector('.hud__score')?.textContent).toBe('50');
  });

  it('keeps the label intact', () => {
    const hud = createHud();
    renderScore(hud, 999);
    expect(hud.querySelector('.hud__label')?.textContent).toBe('SCORE');
  });
});

describe('createHud() — best-score pair', () => {
  it('contains a .hud__pair--best with label "BEST" and score "0"', () => {
    const hud = createHud();
    const bestPair = hud.querySelector<HTMLElement>('.hud__pair--best');
    expect(bestPair).not.toBeNull();
    expect(bestPair?.querySelector('.hud__label')?.textContent).toBe('BEST');
    expect(bestPair?.querySelector('.hud__score')?.textContent).toBe('0');
  });

  it('contains a .hud__pair--current with label "SCORE" and score "0"', () => {
    const hud = createHud();
    const currentPair = hud.querySelector<HTMLElement>('.hud__pair--current');
    expect(currentPair).not.toBeNull();
    expect(currentPair?.querySelector('.hud__label')?.textContent).toBe('SCORE');
    expect(currentPair?.querySelector('.hud__score')?.textContent).toBe('0');
  });
});

describe('renderBestScore()', () => {
  it('updates the best score without touching the current score', () => {
    const hud = createHud();
    renderScore(hud, 100);
    renderBestScore(hud, 540);
    expect(
      hud.querySelector<HTMLElement>('.hud__pair--current .hud__score')
        ?.textContent,
    ).toBe('100');
    expect(
      hud.querySelector<HTMLElement>('.hud__pair--best .hud__score')
        ?.textContent,
    ).toBe('540');
  });
});

describe('createHud() — mute button', () => {
  it('exposes a .hud__mute button with default label "Mute"', () => {
    const hud = createHud();
    const button = hud.querySelector<HTMLButtonElement>('.hud__mute');
    expect(button).not.toBeNull();
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.textContent).toBe('Mute');
    expect(button?.getAttribute('aria-label')).toBe('Mute audio');
  });
});

describe('renderMute()', () => {
  it('shows "Unmute" and aria-label "Unmute audio" when muted=true', () => {
    const hud = createHud();
    renderMute(hud, true);
    const button = hud.querySelector<HTMLButtonElement>('.hud__mute');
    expect(button?.textContent).toBe('Unmute');
    expect(button?.getAttribute('aria-label')).toBe('Unmute audio');
  });

  it('shows "Mute" and aria-label "Mute audio" when muted=false', () => {
    const hud = createHud();
    renderMute(hud, true);
    renderMute(hud, false);
    const button = hud.querySelector<HTMLButtonElement>('.hud__mute');
    expect(button?.textContent).toBe('Mute');
    expect(button?.getAttribute('aria-label')).toBe('Mute audio');
  });
});

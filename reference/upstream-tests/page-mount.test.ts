import { describe, it, expect, beforeAll } from 'vitest';
import { APP_VERSION } from '../src/version';

// Integration smoke only: proves `main.ts` wires the pieces together.
// Each component's internals are owned by its own unit test
// (board / tray / hud / overlay / start-gate / version).
describe('main.ts entry point', () => {
  beforeAll(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await import('../src/main');
  });

  it('mounts the full app structure under #app', () => {
    const app = document.getElementById('app');
    expect(app).not.toBeNull();
    expect(app?.querySelectorAll('.board__cell').length).toBe(100);
    expect(app?.querySelectorAll('.tray__slot').length).toBe(3);
    expect(app?.querySelector('.hud')).not.toBeNull();
    expect(
      app?.querySelector<HTMLElement>('.overlay')?.dataset['visible'],
    ).toBe('false');
    expect(
      app?.querySelector<HTMLElement>('.combo-callout')?.dataset['visible'],
    ).toBe('false');
    expect(
      app?.querySelector<HTMLElement>('.start-gate')?.dataset['visible'],
    ).toBe('true');
    expect(app?.querySelector('.version')?.textContent).toBe(APP_VERSION);
  });

  it('mounts HUD before board before tray (DOM order)', () => {
    const children = Array.from(
      document.getElementById('app')?.children ?? [],
    );
    const idx = (cls: string) =>
      children.findIndex((c) => c.classList.contains(cls));
    expect(idx('hud')).toBeGreaterThanOrEqual(0);
    expect(idx('board')).toBeGreaterThan(idx('hud'));
    expect(idx('tray')).toBeGreaterThan(idx('board'));
  });

  it('start gate dismisses when its button is clicked (wired to onStart)', () => {
    const app = document.getElementById('app');
    app?.querySelector<HTMLButtonElement>('.start-gate__button')?.click();
    expect(
      app?.querySelector<HTMLElement>('.start-gate')?.dataset['visible'],
    ).toBe('false');
  });
});

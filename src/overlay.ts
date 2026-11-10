export type OverlayState = {
  readonly visible: boolean;
  readonly score: number;
};

export function createOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.dataset['visible'] = 'false';

  const heading = document.createElement('div');
  heading.className = 'overlay__heading';
  heading.textContent = 'GAME OVER';

  const score = document.createElement('div');
  score.className = 'overlay__score';
  score.textContent = '0';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'overlay__button';
  button.textContent = 'New game';

  overlay.appendChild(heading);
  overlay.appendChild(score);
  overlay.appendChild(button);
  return overlay;
}

export function renderOverlay(
  overlayEl: HTMLElement,
  state: OverlayState,
): void {
  overlayEl.dataset['visible'] = state.visible ? 'true' : 'false';
  const target = overlayEl.querySelector<HTMLElement>('.overlay__score');
  if (target) target.textContent = String(state.score);
}

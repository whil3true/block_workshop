export type OverlayLabels = { readonly gameOver: string; readonly newGame: string };

export type OverlayState = {
  readonly labels?: OverlayLabels;
  readonly visible: boolean;
  readonly score: number;
};

export function createOverlay(labels: OverlayLabels = { gameOver: 'GAME OVER', newGame: 'New game' }): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.dataset['visible'] = 'false';

  const heading = document.createElement('div');
  heading.className = 'overlay__heading';
  heading.textContent = labels.gameOver;

  const score = document.createElement('div');
  score.className = 'overlay__score';
  score.textContent = '0';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'overlay__button';
  button.textContent = labels.newGame;

  overlay.appendChild(heading);
  overlay.appendChild(score);
  overlay.appendChild(button);
  return overlay;
}

export function renderOverlay(
  overlayEl: HTMLElement,
  state: OverlayState,
): void {
  if (state.labels) {
    const heading = overlayEl.querySelector<HTMLElement>('.overlay__heading');
    const button = overlayEl.querySelector<HTMLButtonElement>('.overlay__button');
    if (heading && heading.textContent !== state.labels.gameOver) heading.textContent = state.labels.gameOver;
    if (button && button.textContent !== state.labels.newGame) button.textContent = state.labels.newGame;
  }
  // Update visible state only after its text is localized.
  overlayEl.dataset['visible'] = state.visible ? 'true' : 'false';
  const target = overlayEl.querySelector<HTMLElement>('.overlay__score');
  if (target) target.textContent = String(state.score);
}

export function createHud(): HTMLElement {
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.appendChild(createPair('current', 'SCORE'));
  hud.appendChild(createPair('best', 'BEST'));
  hud.appendChild(createMuteButton());
  return hud;
}

export function renderScore(hudEl: HTMLElement, score: number): void {
  const target = hudEl.querySelector<HTMLElement>(
    '.hud__pair--current .hud__score',
  );
  if (target) target.textContent = String(score);
}

export function renderBestScore(hudEl: HTMLElement, bestScore: number): void {
  const target = hudEl.querySelector<HTMLElement>(
    '.hud__pair--best .hud__score',
  );
  if (target) target.textContent = String(bestScore);
}

export function renderMute(hudEl: HTMLElement, muted: boolean): void {
  const button = hudEl.querySelector<HTMLButtonElement>('.hud__mute');
  if (!button) return;
  button.textContent = muted ? 'Unmute' : 'Mute';
  button.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
}

function createPair(variant: 'current' | 'best', label: string): HTMLElement {
  const pair = document.createElement('div');
  pair.className = `hud__pair hud__pair--${variant}`;

  const labelEl = document.createElement('span');
  labelEl.className = 'hud__label';
  labelEl.textContent = label;

  const scoreEl = document.createElement('span');
  scoreEl.className = 'hud__score';
  scoreEl.textContent = '0';

  pair.appendChild(labelEl);
  pair.appendChild(scoreEl);
  return pair;
}

function createMuteButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hud__mute';
  button.textContent = 'Mute';
  button.setAttribute('aria-label', 'Mute audio');
  return button;
}

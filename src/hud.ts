export function createHud(): HTMLElement {
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.appendChild(createPair('current', 'SCORE'));
  hud.appendChild(createPair('best', 'BEST'));
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

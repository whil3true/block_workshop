export type HudLabels = { readonly score: string; readonly best: string };

export function createHud(labels: HudLabels = { score: 'SCORE', best: 'BEST' }): HTMLElement {
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.appendChild(createPair('current', labels.score));
  hud.appendChild(createPair('best', labels.best));
  return hud;
}

/** The labels are refreshed before numeric/game-over paints on every render. */
export function renderHudLabels(hudEl: HTMLElement, labels: HudLabels): void {
  const current = hudEl.querySelector<HTMLElement>('.hud__pair--current .hud__label');
  const best = hudEl.querySelector<HTMLElement>('.hud__pair--best .hud__label');
  if (current && current.textContent !== labels.score) current.textContent = labels.score;
  if (best && best.textContent !== labels.best) best.textContent = labels.best;
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

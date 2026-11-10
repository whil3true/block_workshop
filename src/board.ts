import { BOARD_SIZE, type BoardState } from './engine';

export function createBoard(): HTMLElement {
  const board = document.createElement('div');
  board.className = 'board';

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = document.createElement('div');
      cell.className = 'board__cell';
      cell.dataset['state'] = 'empty';
      cell.dataset['row'] = String(row);
      cell.dataset['col'] = String(col);
      board.appendChild(cell);
    }
  }

  return board;
}

export function renderBoardState(
  boardElement: HTMLElement,
  state: BoardState,
): void {
  const cells = boardElement.querySelectorAll<HTMLElement>('.board__cell');
  for (const cell of cells) {
    const row = Number(cell.dataset['row']);
    const col = Number(cell.dataset['col']);
    const value = state[row]?.[col] ?? null;
    if (value === null) {
      cell.dataset['state'] = 'empty';
      cell.style.removeProperty('--piece-color');
    } else {
      cell.dataset['state'] = 'filled';
      cell.style.setProperty('--piece-color', `var(--color-piece-${value})`);
    }
  }
}

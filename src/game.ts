import {
  applyPlacement,
  createEmptyBoard,
  hasAnyLegalPlacement,
  lineBonus,
  resolveClears,
  streakMultiplier,
  type BoardState,
} from './engine';
import { CATALOG, findPieceById, sampleTray, type Piece } from './pieces';
import { createBoard, renderBoardState } from './board';
import { createTray, renderPieceInSlot, TRAY_SIZE } from './tray';
import { createHud, renderBestScore, renderScore } from './hud';
import { createOverlay, renderOverlay } from './overlay';
import { createSilentAudio, type AudioApi } from './audio';
import {
  clearLastGame,
  loadBestScore,
  loadLastGame,
  saveBestScore,
  saveLastGame,
} from './storage';

export { TRAY_SIZE };

export type GameOptions = {
  readonly rng?: () => number;
  readonly initialBoard?: BoardState;
  readonly audio?: AudioApi;
  readonly canInteract?: () => boolean;
  readonly onRestart?: () => void;
  readonly onChange?: () => void;
};

export type GameApi = {
  mount(root: HTMLElement): void;
  place(slotIndex: number, anchorRow: number, anchorCol: number): void;
  newGame(): void;
  commitRestart(): void;
  setPresentationPaused(value: boolean): void;
  prepareReward(): TrayOffer | null;
  commitReward(offer: TrayOffer): boolean;
  readonly rewardUsed: boolean;
  readonly canReward: boolean;
  readonly session: number;
  readonly revision: number;
  readonly boardState: BoardState;
  readonly trayPieces: ReadonlyArray<Piece | null>;
  readonly score: number;
  readonly streak: number;
  readonly bestScore: number;
  readonly gameOver: boolean;
};

export type TrayOffer = { readonly session: number; readonly revision: number; readonly pieces: readonly Piece[] };

const PERFECT_CLEAR_BONUS = 300;

function isBoardEmpty(board: BoardState): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (cell !== null) return false;
    }
  }
  return true;
}

const COMBO_CALLOUT_DURATION_MS = 900;

function createComboCallout(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'combo-callout';
  el.dataset['visible'] = 'false';
  return el;
}

export function createGame(options: GameOptions = {}): GameApi {
  const rng = options.rng ?? Math.random;
  const audio = options.audio ?? createSilentAudio();
  let board: BoardState = options.initialBoard ?? createEmptyBoard();
  let tray: Array<Piece | null> = [];
  let score = 0;
  let streak = 0;
  let bestScore = loadBestScore();
  let gameOver = false;
  let session = 1;
  let revision = 0;
  let rewardUsed = false;
  let presentationPaused = false;
  let comboRemaining = 0;
  let comboStartedAt = 0;
  let comboTimeoutId: ReturnType<typeof setTimeout> | null = null;
  const boardEl = createBoard();
  const trayEl = createTray();
  const hudEl = createHud();
  const overlayEl = createOverlay();
  const comboEl = createComboCallout();

  function showComboCallout(currentStreak: number): void {
    comboEl.textContent = `COMBO ×${currentStreak}`;
    comboEl.dataset['visible'] = 'true';
    if (comboTimeoutId !== null) clearTimeout(comboTimeoutId);
    comboRemaining = COMBO_CALLOUT_DURATION_MS;
    scheduleCombo();
  }

  function scheduleCombo(): void {
    if (presentationPaused) return;
    comboStartedAt = Date.now();
    comboTimeoutId = setTimeout(() => {
      comboEl.dataset['visible'] = 'false';
      comboTimeoutId = null;
    }, comboRemaining);
  }

  function setPresentationPaused(value: boolean): void {
    if (presentationPaused === value) return;
    presentationPaused = value;
    if (value && comboTimeoutId !== null) {
      comboRemaining = Math.max(0, comboRemaining - (Date.now() - comboStartedAt));
      clearTimeout(comboTimeoutId); comboTimeoutId = null;
    } else if (!value && comboEl.dataset['visible'] === 'true') scheduleCombo();
  }

  function hideComboCallout(): void {
    if (comboTimeoutId !== null) {
      clearTimeout(comboTimeoutId);
      comboTimeoutId = null;
    }
    comboEl.dataset['visible'] = 'false';
  }

  function refillTray(): void {
    tray = sampleTray(rng, TRAY_SIZE);
  }

  function updateGameOver(): void {
    gameOver = !hasAnyLegalPlacement(board, tray);
  }

  function persistSnapshot(): void {
    saveLastGame({
      board,
      trayIds: tray.map((p) => p?.id ?? null),
      score,
      streak,
      rewardUsed,
    });
  }

  function render(): void {
    renderScore(hudEl, score);
    renderBestScore(hudEl, bestScore);
    renderBoardState(boardEl, board);
    const slots = trayEl.querySelectorAll<HTMLElement>('.tray__slot');
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot) continue;
      const piece = tray[i];
      if (piece) {
        renderPieceInSlot(slot, piece);
      } else {
        slot.replaceChildren();
        slot.removeAttribute('data-piece-id');
      }
    }
    renderOverlay(overlayEl, { visible: gameOver, score });
    options.onChange?.();
  }

  // Initial state: prefer initialBoard; otherwise try to resume a snapshot;
  // otherwise start fresh with a refilled tray.
  if (options.initialBoard) {
    refillTray();
  } else {
    const snapshot = loadLastGame();
    if (snapshot) {
      board = snapshot.board;
      score = snapshot.score;
      streak = snapshot.streak;
      rewardUsed = snapshot.rewardUsed ?? false;
      bestScore = Math.max(bestScore, score);
      tray = snapshot.trayIds.map((id) =>
        id === null ? null : findPieceById(id) ?? null,
      );
    } else {
      refillTray();
    }
  }
  updateGameOver();
  if (!options.initialBoard) persistSnapshot();
  render();

  const newGameButton = overlayEl.querySelector<HTMLButtonElement>(
    '.overlay__button',
  );
  if (newGameButton) {
    newGameButton.addEventListener('click', () => {
      if (options.canInteract && !options.canInteract()) return;
      if (options.onRestart) options.onRestart(); else newGame();
    });
  }

  function mount(root: HTMLElement): void {
    root.appendChild(hudEl);
    root.appendChild(boardEl);
    root.appendChild(trayEl);
    root.appendChild(overlayEl);
    root.appendChild(comboEl);
  }

  function place(slotIndex: number, anchorRow: number, anchorCol: number): void {
    if (options.canInteract && !options.canInteract()) return;
    if (gameOver) {
      throw new Error('place: game over');
    }
    if (slotIndex < 0 || slotIndex >= TRAY_SIZE) {
      throw new Error(
        `place: slotIndex ${slotIndex} out of range [0, ${TRAY_SIZE})`,
      );
    }
    const piece = tray[slotIndex];
    if (!piece) {
      throw new Error(`place: slot ${slotIndex} is already empty`);
    }
    if (!Number.isInteger(slotIndex) || !Number.isInteger(anchorRow) || !Number.isInteger(anchorCol)) return;
    const placed = applyPlacement(board, piece, anchorRow, anchorCol);
    const cleared = resolveClears(placed);
    board = cleared.board;

    const L = cleared.rowsCleared.length + cleared.colsCleared.length;
    const newStreak = L > 0 ? streak + 1 : 0;
    const bonus = Math.round(lineBonus(L) * streakMultiplier(newStreak));
    const perfect = isBoardEmpty(board) ? PERFECT_CLEAR_BONUS : 0;
    score += piece.cells.length + bonus + perfect;
    streak = newStreak;

    revision += 1;
    tray[slotIndex] = null;
    if (tray.every((p) => p === null)) {
      refillTray();
    }
    updateGameOver();

    if (score > bestScore) {
      bestScore = score;
      saveBestScore(bestScore);
    }
    persistSnapshot();

    // SFX priority: gameOver > perfect > combo > clear > place. Exactly one fires.
    if (gameOver) {
      audio.gameOver();
    } else if (perfect > 0) {
      audio.perfect();
    } else if (L >= 2 || newStreak >= 2) {
      audio.combo();
      showComboCallout(newStreak);
    } else if (L === 1) {
      audio.clear();
    } else {
      audio.place();
    }

    render();
  }

  function newGame(): void {
    if (options.canInteract && !options.canInteract()) return;
    commitRestart();
  }

  function commitRestart(): void {
    session += 1; revision += 1; rewardUsed = false;
    board = createEmptyBoard();
    score = 0;
    streak = 0;
    refillTray();
    updateGameOver();
    clearLastGame();
    persistSnapshot();
    hideComboCallout();
    render();
  }

  function prepareReward(): TrayOffer | null {
    if (rewardUsed) return null;
    const fitting = CATALOG.filter((p) => hasAnyLegalPlacement(board, [p]));
    if (!fitting.length) return null;
    const pieces = sampleTray(rng, TRAY_SIZE);
    if (!hasAnyLegalPlacement(board, pieces)) pieces[0] = fitting[0]!;
    return { session, revision, pieces };
  }
  function commitReward(offer: TrayOffer): boolean {
    if (options.canInteract && !options.canInteract()) return false;
    if (offer.session !== session || offer.revision !== revision || rewardUsed || !hasAnyLegalPlacement(board, offer.pieces)) return false;
    tray = offer.pieces.slice(); rewardUsed = true; revision += 1;
    updateGameOver(); persistSnapshot(); render(); return true;
  }
  return {
    commitRestart, prepareReward, commitReward, setPresentationPaused,
    get rewardUsed() { return rewardUsed; },
    get canReward() { return !rewardUsed && CATALOG.some(p => hasAnyLegalPlacement(board, [p])); },
    get session() { return session; },
    get revision() { return revision; },
    mount,
    place,
    newGame,
    get boardState() {
      return board;
    },
    get trayPieces() {
      return tray.slice();
    },
    get score() {
      return score;
    },
    get streak() {
      return streak;
    },
    get bestScore() {
      return bestScore;
    },
    get gameOver() {
      return gameOver;
    },
  };
}

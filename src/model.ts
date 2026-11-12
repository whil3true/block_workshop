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
import { createSilentAudio, type AudioApi } from './audio';
import {
  clearLastGame,
  loadBestScore,
  loadLastGame,
  saveBestScore,
  saveLastGame,
} from './storage';

export const TRAY_SIZE = 3;

export type ModelOptions = {
  readonly rng?: () => number;
  readonly initialBoard?: BoardState;
  readonly audio?: AudioApi;
  readonly canInteract?: () => boolean;
  readonly onChange?: () => void;
  readonly onCombo?: (streak: number) => void;
};

export type ModelApi = {
  place(slotIndex: number, anchorRow: number, anchorCol: number): void;
  newGame(): void;
  commitRestart(): void;
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

export function createModel(options: ModelOptions = {}): ModelApi {
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

  function notify(): void { options.onChange?.(); }

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
  notify();

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
      options.onCombo?.(newStreak);
    } else if (L === 1) {
      audio.clear();
    } else {
      audio.place();
    }

    notify();
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
    notify();
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
    updateGameOver(); persistSnapshot(); notify(); return true;
  }
  return {
    commitRestart, prepareReward, commitReward,
    get rewardUsed() { return rewardUsed; },
    get canReward() { return !rewardUsed && CATALOG.some(p => hasAnyLegalPlacement(board, [p])); },
    get session() { return session; },
    get revision() { return revision; },
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

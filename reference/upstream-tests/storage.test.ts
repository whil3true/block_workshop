import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadBestScore,
  saveBestScore,
  loadLastGame,
  saveLastGame,
  clearLastGame,
  loadMute,
  saveMute,
  type LastGame,
} from '../src/storage';
import { createEmptyBoard } from '../src/engine';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('best-score persistence', () => {
  it('loadBestScore returns 0 when nothing is stored', () => {
    expect(loadBestScore()).toBe(0);
  });

  it('saveBestScore + loadBestScore round-trip', () => {
    saveBestScore(1234);
    expect(loadBestScore()).toBe(1234);
  });

  it('loadBestScore returns 0 for a non-numeric stored value', () => {
    localStorage.setItem('blockly:bestScore', 'not-a-number');
    expect(loadBestScore()).toBe(0);
  });

  it('loadBestScore returns 0 for a negative stored value', () => {
    localStorage.setItem('blockly:bestScore', '-50');
    expect(loadBestScore()).toBe(0);
  });

  it('saveBestScore tolerates a throwing setItem', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => saveBestScore(42)).not.toThrow();
  });
});

describe('last-game persistence', () => {
  function sampleLastGame(): LastGame {
    const board = createEmptyBoard();
    return {
      board,
      trayIds: ['single', 'penta-h', null],
      score: 540,
      streak: 2,
    };
  }

  it('loadLastGame returns null when nothing is stored', () => {
    expect(loadLastGame()).toBeNull();
  });

  it('saveLastGame + loadLastGame round-trip a valid state', () => {
    const state = sampleLastGame();
    saveLastGame(state);
    const loaded = loadLastGame();
    expect(loaded).not.toBeNull();
    expect(loaded?.score).toBe(540);
    expect(loaded?.streak).toBe(2);
    expect(loaded?.trayIds).toEqual(['single', 'penta-h', null]);
    expect(loaded?.board.length).toBe(10);
  });

  it('loadLastGame returns null on unparseable JSON', () => {
    localStorage.setItem('blockly:lastGame', '{not json');
    expect(loadLastGame()).toBeNull();
  });

  it('loadLastGame returns null on wrong-shape JSON', () => {
    localStorage.setItem(
      'blockly:lastGame',
      JSON.stringify({ board: [[]], trayIds: [], score: 0, streak: 0 }),
    );
    expect(loadLastGame()).toBeNull();
  });

  it('loadLastGame returns null when a board cell carries an unknown family', () => {
    const board: Array<Array<string | null>> = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => null as string | null),
    );
    const firstRow = board[0];
    if (firstRow) firstRow[0] = 'banana';
    localStorage.setItem(
      'blockly:lastGame',
      JSON.stringify({
        board,
        trayIds: ['single', null, null],
        score: 0,
        streak: 0,
      }),
    );
    expect(loadLastGame()).toBeNull();
  });

  it('loadLastGame accepts a board cell carrying a new catalogue family', () => {
    const board: Array<Array<string | null>> = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => null as string | null),
    );
    const firstRow = board[0];
    if (firstRow) firstRow[0] = 'tetro-l'; // iteration-30 family
    localStorage.setItem(
      'blockly:lastGame',
      JSON.stringify({
        board,
        trayIds: ['single', null, null],
        score: 0,
        streak: 0,
      }),
    );
    expect(loadLastGame()).not.toBeNull();
  });

  it('clearLastGame removes the key', () => {
    saveLastGame(sampleLastGame());
    expect(loadLastGame()).not.toBeNull();
    clearLastGame();
    expect(loadLastGame()).toBeNull();
  });

  it('saveLastGame tolerates a throwing setItem', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveLastGame(sampleLastGame())).not.toThrow();
  });
});

describe('mute persistence', () => {
  it('loadMute returns false when nothing is stored', () => {
    expect(loadMute()).toBe(false);
  });

  it('saveMute(true) + loadMute returns true', () => {
    saveMute(true);
    expect(loadMute()).toBe(true);
  });

  it('saveMute(false) + loadMute returns false', () => {
    saveMute(true);
    saveMute(false);
    expect(loadMute()).toBe(false);
  });

  it('loadMute returns false for any non-"true" string', () => {
    localStorage.setItem('blockly:mute', 'yes');
    expect(loadMute()).toBe(false);
  });
});

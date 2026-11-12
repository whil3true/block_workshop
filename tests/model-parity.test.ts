import { describe, it, expect } from 'vitest';
import { createModel, type ModelApi } from '../src/model';
import { createGame } from './legacy/game';
import { canPlace } from '../src/engine';
import { createSilentAudio } from '../src/audio';
import { mulberry32 } from './helpers';
import { boardAnchor } from '../src/phaser/BoardGeometry';
import { saveLastGame } from '../src/storage';
import { LocaleRuntime } from '../src/app/LocaleRuntime';
function state(game: ModelApi) {
 return { board: game.boardState, tray: game.trayPieces.map(p => p?.id ?? null), score: game.score, best: game.bestScore,
  streak: game.streak, over: game.gameOver, reward: game.rewardUsed, canReward: game.canReward, session: game.session, revision: game.revision };
}
describe('production model matches the frozen DOM controller', () => {
 it.each([1, 2, 7, 42, 99, 12345, 76543, 0xabcdef])('same seeded moves, rewards, restart, score and audio: %i', seed => {
  const audioEvents: string[][] = [[], []];
  const audio = (index: number) => Object.fromEntries(Object.entries(createSilentAudio()).map(([key, fn]) => [key, key === 'isMuted' ? fn : () => audioEvents[index]!.push(key)])) as ReturnType<typeof createSilentAudio>;
  const model = createModel({ rng: mulberry32(seed), audio: audio(0) });
  localStorage.clear();
  const legacy = createGame({ rng: mulberry32(seed), audio: audio(1) });
  const movesRng = mulberry32(seed + 8);
  for (let move = 0; move < 100; move++) {
   expect(state(model)).toEqual(state(legacy));
   expect(audioEvents[0]).toEqual(audioEvents[1]);
   if ((move === 15 || model.gameOver) && model.canReward) {
    const a = model.prepareReward()!, b = legacy.prepareReward()!;
    expect(a).toEqual(b); expect(model.commitReward(a)).toBe(legacy.commitReward(b));
    expect(model.commitReward(a)).toBe(false); expect(legacy.commitReward(b)).toBe(false);
   }
   if (move === 50 || model.gameOver) { model.commitRestart(); legacy.commitRestart(); }
   const candidates: number[][] = [];
   model.trayPieces.forEach((piece, slot) => { if (piece) for (let row = 0; row < 10; row++) for (let col = 0; col < 10; col++) if (canPlace(model.boardState, piece, row, col)) candidates.push([slot, row, col]); });
   const [slot, row, col] = candidates[Math.floor(movesRng() * candidates.length)]!;
   model.place(slot!, row!, col!); legacy.place(slot!, row!, col!);
  }
  expect(state(model)).toEqual(state(legacy));
 });
 it('reaches defeat after a legal move, then commits a clean restart', () => {
  const board = Array.from({length:10},(_,r)=>Array.from({length:10},(_,c)=>r===c?null:'sq2' as const));
  saveLastGame({board,trayIds:['single','square-3','square-3'],score:75,streak:0,rewardUsed:false});
  const model = createModel(); expect(model.gameOver).toBe(false);model.place(0,0,0);
  expect(model.score).toBe(106);expect(model.gameOver).toBe(true);expect(model.canReward).toBe(true);
  model.commitRestart();expect(model.gameOver).toBe(false);expect(model.score).toBe(0);
  expect(model.boardState.flat().every(c=>c===null)).toBe(true);
 });
 it('does not construct DOM in the production model', () => {
  const spy = vi.spyOn(document, 'createElement'); createModel(); expect(spy).not.toHaveBeenCalled(); spy.mockRestore();
 });
 it('persists the first platform locale and respects it on subsequent startup', () => {
  expect(new LocaleRuntime('ru').locale).toBe('ru');
  expect(localStorage.getItem('block-workshop:ui-locale')).toBe('ru');
  expect(new LocaleRuntime('en').locale).toBe('ru');
 });
 it('top-left and bottom-right cells stay reachable, outside coordinates are rejected', () => {
  expect(boardAnchor(20,156)).toEqual({row:0,col:0});
  expect(boardAnchor(459.99,595.99)).toEqual({row:9,col:9});
  expect(boardAnchor(460,596)).toBeNull(); expect(boardAnchor(19.99,156)).toBeNull();
 });
});
